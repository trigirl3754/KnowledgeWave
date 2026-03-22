const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

function json(status, body) {
  return {
    status,
    jsonBody: body,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  };
}

function noContent() {
  return {
    status: 204,
    headers: corsHeaders,
  };
}

module.exports = {
  corsHeaders,
  json,
  noContent,
};
