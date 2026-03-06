const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { AutoUnpackNativesPlugin } = require('@electron-forge/plugin-auto-unpack-natives');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: {
      unpack: '**/*.node',
      unpackDir: '**/node_modules/{sqlite3,bindings,file-uri-to-path,node-addon-api}/**',
    },
    // With @electron-forge/plugin-vite, everything except /.vite is ignored by default.
    // sqlite3 is a runtime native dependency, so explicitly keep its runtime modules.
    ignore: (file) => {
      if (!file) return false;
      const normalized = String(file).replace(/\\/g, '/');
      // Keep Vite main/preload build output.
      if (normalized === '/.vite' || normalized.startsWith('/.vite/')) return false;
      if (normalized.includes('/.vite/')) return false;

      // Keep runtime dependencies; this avoids missing native modules in packaged app.
      if (normalized === '/node_modules' || normalized.startsWith('/node_modules/')) return false;
      if (normalized.includes('/node_modules/')) return false;

      // Keep static multi-page renderer assets.
      if (normalized.endsWith('.html')) return false;
      if (normalized.endsWith('/styles.css')) return false;
      if (normalized === '/src' || normalized.startsWith('/src/')) return false;
      if (normalized.includes('/src/')) return false;

      return true;
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    // Required for native modules like sqlite3 in packaged builds.
    new AutoUnpackNativesPlugin({}),
    {
      name: '@electron-forge/plugin-vite',
      config: {
        // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
        // If you are familiar with Vite configuration, it will look really familiar.
        build: [
          {
            // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
            entry: 'src/main.js',
            config: 'vite.main.config.mjs',
            target: 'main',
          },
          {
            entry: 'src/preload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.mjs',
          },
        ],
      },
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
