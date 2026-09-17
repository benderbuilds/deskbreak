// Stand-in for `next/headers`: a request cookie jar the tests can set.
let jar = new Map();

module.exports = {
  setTestCookies(cookies) {
    jar = new Map(Object.entries(cookies));
  },
  async cookies() {
    return {
      get(name) {
        return jar.has(name) ? { name, value: jar.get(name) } : undefined;
      },
      set(name, value) {
        jar.set(name, value);
      },
      delete(name) {
        jar.delete(name);
      },
    };
  },
};
