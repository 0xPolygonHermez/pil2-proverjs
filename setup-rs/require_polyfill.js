// Polyfill for Node.js-style `require`
globalThis.require = async (modulePath) => {
  console.log(`Requiring module: ${modulePath}`);

  // Normalize the path
  const normalizedPath = modulePath.startsWith("./") || modulePath.startsWith("../")
    ? modulePath.endsWith(".js") ? modulePath : `${modulePath}.js`
    : `./${modulePath}.js`;

  console.log(`Normalized path: ${normalizedPath}`);

  try {
    // Resolve the path relative to the embedded `src` directory
    const resolvedPath = new URL(normalizedPath, "file:///src/").href;
    console.log(`Resolved path: ${resolvedPath}`);

    const module = await import(resolvedPath);
    return module;
  } catch (err) {
    console.error(`Failed to import module: ${modulePath}`, err);
    throw new Error(`Module not found: ${modulePath}`);
  }
};
