const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => {
    const source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    module._compile(output, filename);
  };
}

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const {
  buscarPresetCercano,
  coordenadasClienteARueda,
  hexAHSV,
  hsvAHex,
  puntoAHSV,
  puntoDesdeHex,
} = require('../src/servicios/ruedaColores.ts');
const { RuedaColores } = require('../src/componentes/RuedaColores.tsx');
const { calcularPosicionRueda } = require('../src/servicios/posicionRueda.ts');
const { construirComandosColorSeleccion } = require('../src/servicios/operacionesCabina.ts');
const { bloqueoDeSeguridadCompuesto } = require('../src/seguridadComandos.ts');

const catalogo = [
  { id: 'rojo', nombre: 'Rojo', preset: '4.2', hex: '#ff0000', sinonimos: ['rojo'] },
  { id: 'verde', nombre: 'Verde', preset: '4.5', hex: '#00ff00', sinonimos: ['verde'] },
  { id: 'azul', nombre: 'Azul', preset: '4.7', hex: '#0000ff', sinonimos: ['azul'] },
];

// 1. Coordenadas del disco y conversiones HSV/HEX.
assert.equal(hsvAHex(puntoAHSV(0, 0)), '#ffffff');
assert.equal(hsvAHex(puntoAHSV(1, 0)), '#ff0000');
assert.equal(hsvAHex(puntoAHSV(0, -1)), '#80ff00');
assert.equal(hsvAHex(puntoAHSV(-1, 0)), '#00ffff');
assert.equal(hsvAHex(puntoAHSV(0, 1)), '#8000ff');
assert.equal(hsvAHex(puntoAHSV(2, 0)), '#ff0000');
assert.equal(hexAHSV('invalido'), null);
assert.ok(Math.abs(puntoDesdeHex('#0000ff').y - 0.866) < 0.01);

// 2. Clic inicial y posiciones posteriores del arrastre usan el mismo rectángulo.
const rect = { left: 10, top: 20, width: 200, height: 200 };
const click = coordenadasClienteARueda(210, 120, rect);
const arrastre = coordenadasClienteARueda(110, 20, rect);
const fueraDelDisco = coordenadasClienteARueda(500, 120, rect);
assert.equal(hsvAHex(puntoAHSV(click.x, click.y)), '#ff0000');
assert.equal(hsvAHex(puntoAHSV(arrastre.x, arrastre.y)), '#80ff00');
assert.equal(Math.hypot(fueraDelDisco.x, fueraDelDisco.y), 1);

// 3-4. Preset más cercano, diferencia explícita y desempate estable.
assert.equal(buscarPresetCercano('#ff0000', catalogo).color.preset, '4.2');
assert.equal(buscarPresetCercano('#ff0000', catalogo).exacto, true);
const aproximado = buscarPresetCercano('#e02020', catalogo);
assert.equal(aproximado.color.preset, '4.2');
assert.equal(aproximado.exacto, false);
assert.ok(aproximado.diferencia > 0);
assert.equal(buscarPresetCercano('#ff0000', [catalogo[0], { ...catalogo[0], id: 'antes', preset: '4.1' }]).color.preset, '4.1');

// 5. Confirmar el preset seleccionado usa los constructores existentes para uno o varios grupos.
const uno = construirComandosColorSeleccion(['3'], aproximado.color.preset);
const varios = construirComandosColorSeleccion(['1', '4'], aproximado.color.preset);
assert.deepEqual(uno, [{ accion: 'color', grupo: '3', valor: '4.2', tipo: 'color' }]);
assert.deepEqual(varios.map((c) => c.grupo), ['1', '4']);
assert.equal(bloqueoDeSeguridadCompuesto(varios), null);

// 6. Abrir, previsualizar y cancelar no llaman al callback de aplicación.
let aplicaciones = 0;
const props = {
  ancla: null,
  tema: 'cabina',
  colores: catalogo,
  colorInicial: '#e02020',
  gruposDestino: 'G1, G4',
  disponible: true,
  motivoNoDisponible: '',
  alAplicar: async () => { aplicaciones += 1; return true; },
  alCerrar: () => {},
};
let html = renderToStaticMarkup(React.createElement(RuedaColores, props));
assert.match(html, /Aproximación/);
assert.match(html, /Aplicar color/);
assert.match(html, /id="rueda-colores-panel"[^>]*role="dialog"/);
assert.match(html, /role="slider"[^>]*tabindex="0"/);
assert.match(html, />Cancelar<\/button>/);
assert.equal(aplicaciones, 0);

// 7. Al cambiar el catálogo, el componente muestra el nuevo preset sin duplicados fijos.
html = renderToStaticMarkup(React.createElement(RuedaColores, {
  ...props,
  colores: [{ ...catalogo[0], preset: '4.9', nombre: 'Rojo nuevo' }],
}));
assert.match(html, /Rojo nuevo · Preset 4\.9/);
assert.doesNotMatch(html, /Preset 4\.2/);

// 8. Catálogos vacíos o inválidos deshabilitan la aplicación.
for (const colores of [[], [{ ...catalogo[0], preset: 'invalido' }], [{ ...catalogo[0], hex: 'mal' }]]) {
  assert.equal(buscarPresetCercano('#ff0000', colores), null);
  html = renderToStaticMarkup(React.createElement(RuedaColores, { ...props, colores }));
  assert.match(html, /No hay presets de color válidos configurados/);
  assert.match(html, /disabled=""[^>]*>Aplicar color/);
}
assert.equal(buscarPresetCercano('mal', catalogo), null);

// Panel: bajo el botón cuando cabe, encima cuando falta espacio y siempre dentro del viewport.
assert.deepEqual(
  calcularPosicionRueda({ left: 1397, right: 1471, top: 314, bottom: 348 }, 380, 1530, 1000),
  { left: 1161, top: 356, width: 310 }
);
const arriba = calcularPosicionRueda({ left: 1397, right: 1471, top: 314, bottom: 348 }, 380, 1530, 850);
assert.equal(arriba.top, 356); // El espacio inferior aún es suficiente.
const ventanaCorta = calcularPosicionRueda({ left: 1397, right: 1471, top: 314, bottom: 348 }, 380, 1530, 620);
assert.equal(ventanaCorta.top, 12);
const estrecho = calcularPosicionRueda({ left: 155, right: 210, top: 280, bottom: 310 }, 420, 240, 360);
assert.ok(estrecho.left >= 12 && estrecho.left + estrecho.width <= 228);
assert.ok(estrecho.top >= 12 && estrecho.top <= 348);
assert.equal(estrecho.width, 216);
console.log('Pruebas de rueda de colores: correctas.');
