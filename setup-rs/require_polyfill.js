// Polyfill for Node.js-style `require`
globalThis.require = async (modulePath) => {
  // Normalize the path to handle relative imports
  const normalizedPath = modulePath.startsWith("./") || modulePath.startsWith("../")
    ? modulePath
    : `./${modulePath}`;

  // Dynamically import the module
  try {
    const module = await import(normalizedPath);
    return module;
  } catch (err) {
    throw new Error(`Module not found: ${modulePath}`);
  }
};
