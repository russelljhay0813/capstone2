module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          // This transforms 'import.meta' so the web browser can understand it
          unstable_transformImportMeta: true,
        },
      ],
    ],
  };
};