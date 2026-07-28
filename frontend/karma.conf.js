/**
 * Configuração do Karma.
 *
 * O motivo de existir: em contêiner e na maioria dos CIs o Chrome não roda com
 * sandbox, e sem esse launcher a suíte falha antes do primeiro teste. Também
 * fixamos `singleRun` fora do modo interativo para o pipeline não ficar
 * esperando por um watcher que nunca termina.
 */
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: {
      jasmine: {random: false},
      clearContext: false,
    },
    jasmineHtmlReporter: {suppressAll: true},
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage'),
      subdir: '.',
      reporters: [{type: 'html'}, {type: 'text-summary'}, {type: 'lcovonly'}],
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['ChromeHeadlessNoSandbox'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      },
    },
    restartOnFileChange: true,
  });
};
