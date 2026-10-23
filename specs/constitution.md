# Constitución del proyecto

Principios que toda spec, plan e implementación deben respetar.

1. **Demo primero**: el flujo completo proyecto → equipo → plan → kanban tiene que andar de punta a punta antes que cualquier extra.
2. **Salidas estructuradas**: todo lo que genera un agente tiene esquema y se persiste; nada de texto libre que no se pueda mostrar.
3. **Transparencia de agentes**: el usuario ve qué agente está trabajando y por qué decidió lo que decidió (justificaciones visibles).
4. **El usuario manda**: si elige metodología, los agentes la respetan; todo lo generado es editable.
5. **Simple antes que escalable**: monolito, SQLite, sin auth hasta que haga falta.
6. **Funciona sin key**: modo mock siempre disponible para desarrollar el front.
7. **Stack Google**: Gemini + ADK para IA; deploy objetivo en Cloud Run.
