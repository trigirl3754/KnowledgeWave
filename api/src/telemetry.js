const appInsights = require("applicationinsights");

let started = false;

function startTelemetry() {
  if (started) {
    return;
  }

  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING || process.env.APPINSIGHTS_CONNECTION_STRING;
  if (!connectionString) {
    return;
  }

  appInsights
    .setup(connectionString)
    .setAutoCollectRequests(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectExceptions(true)
    .setAutoCollectConsole(true, true)
    .setAutoDependencyCorrelation(true)
    .setUseDiskRetryCaching(true)
    .start();

  started = true;
}

module.exports = {
  startTelemetry,
};
