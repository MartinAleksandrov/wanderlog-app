// Local config plugin, debug builds only: on a machine behind Netskope TLS inspection, trust
// Netskope's root certificate so the app on the emulator can reach inspected HTTPS hosts (Convex).
// Active only when the gitignored certs/netskope_root.pem exists at prebuild time; without it
// (CI, other machines) the generated android/ folder is unchanged. Release builds never get it.
const { AndroidConfig, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs/promises');
const path = require('path');

const CERTIFICATE = 'certs/netskope_root.pem';

// The debuggable build types in Expo's Android template
const DEBUG_SOURCE_SETS = ['debug', 'debugOptimized'];

// "system" keeps the normal public CAs trusted. Cleartext stays on because a network security
// config overrides android:usesCleartextTraffic, and debug builds load JS from Metro over http.
const NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
      <certificates src="@raw/netskope_root" />
    </trust-anchors>
  </base-config>
</network-security-config>
`;

async function exists(file) {
  return fs.access(file).then(
    () => true,
    () => false,
  );
}

// A source set's manifest is merged into src/main's for that build type. Edit it if the
// template has one, otherwise create a minimal one.
async function setNetworkSecurityConfig(manifestPath) {
  const manifest = (await exists(manifestPath))
    ? await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath)
    : { manifest: { $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' } } };
  manifest.manifest.application ??= [{ $: {} }];
  manifest.manifest.application[0].$['android:networkSecurityConfig'] =
    '@xml/network_security_config';
  await AndroidConfig.Manifest.writeAndroidManifestAsync(manifestPath, manifest);
}

module.exports = function withNetskopeDebugTrust(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const { projectRoot, platformProjectRoot } = config.modRequest;
      const certificate = path.join(projectRoot, CERTIFICATE);
      if (!(await exists(certificate))) return config;

      for (const sourceSet of DEBUG_SOURCE_SETS) {
        const res = path.join(platformProjectRoot, 'app/src', sourceSet, 'res');
        await fs.mkdir(path.join(res, 'raw'), { recursive: true });
        await fs.mkdir(path.join(res, 'xml'), { recursive: true });
        // Raw resource names allow only lowercase letters, digits and underscores
        await fs.copyFile(certificate, path.join(res, 'raw/netskope_root.pem'));
        await fs.writeFile(
          path.join(res, 'xml/network_security_config.xml'),
          NETWORK_SECURITY_CONFIG,
        );
        await setNetworkSecurityConfig(
          path.join(platformProjectRoot, 'app/src', sourceSet, 'AndroidManifest.xml'),
        );
      }
      return config;
    },
  ]);
};
