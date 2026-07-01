const AIRTABLE_API_URL = 'https://api.airtable.com/v0';

// Table IDs (not display names) so the proxy keeps working if someone
// renames a table in Airtable. Base app0dT6mWldFyWgcm:
//   Segments    -> "Track Trail Segments"
//   Communities -> "Manage Trail Communities"
//   Amenities   -> "Maintain Amenity Directory"
const ALLOWED_TABLES = {
  segments: 'tbla9jrcHD375EYO1',
  communities: 'tblA7uFLtYuWVMGGX',
  amenities: 'tbl8H94EhS1ITwvsW',
};

const BASE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: BASE_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: BASE_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return {
      statusCode: 500,
      headers: BASE_HEADERS,
      body: JSON.stringify({ error: 'Server is not configured. Missing Airtable credentials.' }),
    };
  }

  const params = event.queryStringParameters || {};
  const tableId = ALLOWED_TABLES[params.table];

  if (!tableId) {
    return {
      statusCode: 400,
      headers: BASE_HEADERS,
      body: JSON.stringify({
        error: `Invalid or missing "table" parameter. Must be one of: ${Object.keys(ALLOWED_TABLES).join(', ')}`,
      }),
    };
  }

  try {
    const records = await fetchAllRecords({
      apiKey: AIRTABLE_API_KEY,
      baseId: AIRTABLE_BASE_ID,
      tableId,
      view: params.view,
    });

    return {
      statusCode: 200,
      headers: {
        ...BASE_HEADERS,
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
      body: JSON.stringify({ records }),
    };
  } catch (err) {
    console.error('Airtable proxy error:', err.message);
    return {
      statusCode: err.statusCode || 502,
      headers: BASE_HEADERS,
      body: JSON.stringify({ error: 'Failed to fetch data from Airtable.' }),
    };
  }
};

async function fetchAllRecords({ apiKey, baseId, tableId, view }) {
  const records = [];
  let offset;

  do {
    const url = new URL(`${AIRTABLE_API_URL}/${baseId}/${tableId}`);
    url.searchParams.set('pageSize', '100');
    if (view) url.searchParams.set('view', view);
    if (offset) url.searchParams.set('offset', offset);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      const error = new Error(`Airtable responded with ${response.status}`);
      error.statusCode = response.status === 404 ? 404 : 502;
      throw error;
    }

    const data = await response.json();
    records.push(...(data.records || []));
    offset = data.offset;
  } while (offset);

  return records;
}
