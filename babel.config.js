module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          alias: {
            "@": ".",
            "@/components": "./components",
            "@/engine": "./engine",
            "@/hooks": "./hooks",
            "@/store": "./store",
            "@/utils": "./utils",
            "@/assets": "./assets",
          },
        },
      ],
      "react-native-reanimated/plugin",
    ],
  };
};
