# Constitución del proyecto

Principios que toda spec, plan e implementación deben respetar.

1. **Demo primero**: el flujo completo proyecto → equipo → plan → kanban tiene que andar de punta a punta antes que cualquier extra.
2. **Salidas estructuradas**: todo lo que genera un agente tiene esquema y se persiste; nada de texto libre que no se pueda mostrar.
3. **Transparencia de agentes**: el usuario ve qué agente está trabajando y por qué decidió lo que decidió (justificaciones visibles).
4. **El usuario manda**: si elige metodología, los agentes la respetan; todo lo generado es editable.
5. **Simple antes que escalable**: monolito, SQLite, sin auth de usuarios hasta que haga falta (GitHub usa un token por proyecto).
6. **Funciona sin key**: modo mock siempre disponible para desarrollar el front.
7. **Stack Google**: Gemini + ADK para IA; deploy objetivo en Cloud Run.
8. **Nada se aplica sin aprobación**: toda decisión de un agente es una propuesta que el usuario aprueba, ajusta o rechaza (o se aprueba sola si el proyecto tiene auto-aprobar).
9. **Hexagonal**: el dominio no depende de frameworks ni de servicios externos; todo lo de afuera entra por un puerto.
