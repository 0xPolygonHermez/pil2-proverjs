// Polyfill for Node.js-style `require`
globalThis.require = (modulePath) => {
  // Normalize the path to handle relative imports
  const normalizedPath = modulePath.startsWith("./") || modulePath.startsWith("../")
    ? modulePath
    : `./${modulePath}`;

  // Dynamically import the module, relative to the baked-in `src` directory
  const resolvedPath = normalizedPath.replace(/^(\.\/|\/)/, ""); // Strip leading "./" or "/"

  try {
    // Load the module through the embedded loader
    const module = import(resolvedPath);
    return module;
  } catch (err) {
    throw new Error(`Module not found: ${modulePath}`);
  }
};
