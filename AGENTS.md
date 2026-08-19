# Directrices del Proyecto y Reglas de Diseño Impeccable

Este proyecto utiliza el sistema de diseño y habilidades **Impeccable** (`.agents/skills/impeccable/` y `.gemini/skills/impeccable/`) para garantizar interfaces web de altísima calidad estética, técnica y de conversión, alejadas de cualquier cliché de IA genérica.

## Reglas Obligatorias de Frontend y Diseño (Craft Floor)

1. **Cero Clichés de IA (Anti-Patterns)**:
   - Prohibido el texto con gradientes CSS (`background-clip: text; color: transparent`).
   - Prohibidas las insignias/pills tipo "eyebrow" con punto parpadeante arriba de los titulares principales. El titular debe liderar por su propia fuerza tipográfica.
   - Prohibido el uso de tarjetas idénticas tipo bento repetitivas o tarjetas anidadas dentro de tarjetas.
   - Prohibido el uso de emojis genéricos como sustitutos de iconos. Utilizar únicamente iconos SVG vectoriales personalizados con grosor de trazo uniforme.
   - Prohibido el texto gris sobre fondos de color; el texto secundario debe matizarse a partir del tono del fondo o del color primario.
   - Prohibido el uso de fuentes trilladas por defecto (como Inter o Arial genérico). Usar tipografía con personalidad, jerarquía y tracking intencional (-0.02em a -0.03em).

2. **Acabado Profesional (Browser Surfaces & Micro-interactions)**:
   - Personalizar todas las superficies del navegador: selección de texto (`::selection`), scrollbars personalizados, anillos de foco accesibles (`:focus-visible`), y carets.
   - Micro-interacciones sutiles y elegantes (curvas de aceleración tipo `cubic-bezier(0.16, 1, 0.3, 1)` o ease-out exponencial).
   - Sombras con profundidad y difuminado suave, nunca halos planos de colores.

3. **Arquitectura y Estándares**:
   - HTML5 semántico y accesible (WAI-ARIA, etiquetas de formulario accesibles, diálogos nativos).
   - Vanilla CSS estructurado con Custom Properties (Tokens de diseño claros para espaciado, colores, tipografía y sombras).
   - Vanilla JavaScript ES6+ limpio, modular y reactivo sin sobrecargar librerías innecesarias.
   - Validación constante con el detector mecánico de Impeccable: `node .agents/skills/impeccable/scripts/detect.mjs`.
