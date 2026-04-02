const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = (config) => {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents = setSplitApks(config.modResults.contents);
    }
    return config;
  });
};

function setSplitApks(buildGradle) {
  // البحث عن بلوك الـ android في ملف الـ build.gradle
  // وإضافة إعدادات الـ Split لكل المعماريات
  const splitConfig = `
    splits {
        abi {
            enable true
            reset()
            include "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
            universalApk false
        }
    }`;

  if (!buildGradle.includes('splits {')) {
    return buildGradle.replace(
      /android\s?{/,
      `android {\n${splitConfig}`
    );
  }
  return buildGradle;
}