// Stand-in for the `server-only` package, which throws outside a Next server
// bundle. The modules under test are server-only by design; here they run in
// plain Node.
module.exports = {};
