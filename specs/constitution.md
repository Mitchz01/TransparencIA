# Constitución del proyecto

Principios que toda spec, plan e implementación deben respetar.

1. **Demo primero**: el flujo completo proyecto → equipo → plan → kanban tiene que andar de punta a punta antes que cualquier extra.
2. **Salidas estructuradas**: todo lo que genera un agente tiene esquema y se persiste; nada de texto libre que no se pueda mostrar.
3. **Transparencia de agentes**: el usuario ve qué agente está trabajando y por qué decidió lo que decidió (justificaciones visibles).
4. **El usuario manda**: si elige metodología, los agentes la respetan; todo lo generado es editable.
5. **Arquitectura hexagonal**: el dominio y los casos de uso no dependen de FastAPI, SQLModel ni ADK. Hablan con el exterior solo por puertos, y cada tecnología vive en un adaptador que se puede cambiar sin tocar el núcleo.
6. **Simple antes que escalable**: SQLite y sin auth hasta que haga falta.
7. **Funciona sin key**: modo mock siempre disponible para desarrollar el front (es otro adaptador del puerto de planificación).
8. **Stack Google**: Gemini + ADK para IA; deploy objetivo en Cloud Run.
