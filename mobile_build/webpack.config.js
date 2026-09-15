const createExpoWebpackConfigAsync = require("@expo/webpack-config");

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  const oneOfRule = config.module.rules.find((rule) => Array.isArray(rule.oneOf));
  if (oneOfRule) {
    oneOfRule.oneOf.forEach((rule) => {
      if (rule.use && rule.use.loader && rule.use.loader.includes("babel-loader")) {
        if (!rule.include) {
          rule.include = [];
        } else if (!Array.isArray(rule.include)) {
          rule.include = [rule.include];
        }
        rule.include.push(/react-native-web/, /@expo\/metro-runtime/, /expo-router/);
      }
    });
  }

  return config;
};
