# Wasi — comandos de desarrollo
# Uso: make <target>
.PHONY: help setup web-setup backend frontend test clean

help:
	@echo "Wasi — comandos disponibles:"
	@echo "  make setup     — crea venv del backend e instala dependencias (1 sola vez)"
	@echo "  make web-setup — instala dependencias del frontend Vite (1 sola vez)"
	@echo "  make backend   — arranca FastAPI en :8001 (coincide con VITE_API_BASE)"
	@echo "  make frontend  — arranca el frontend Vite (dev) en :5173"
	@echo "  make test      — corre pytest"
	@echo ""
	@echo "Dev: abrir 2 terminales y correr 'make backend' + 'make frontend'."
	@echo "Despues: open http://localhost:5173"

setup:
	cd app/backend && python3 -m venv venv && \
		venv/bin/pip install --upgrade pip && \
		venv/bin/pip install -r requirements.txt
	@echo ""
	@echo "Nota: venv testeado con Python 3.9-3.12. xgboost 2.1.4 + sklearn 1.6.1 + numpy 2.0.2"
	@echo "Si python3 < 3.9, instalar pyenv: brew install pyenv && pyenv install 3.10.12"
	@echo ""
	@echo "Setup listo. Ahora: 'make web-setup', luego 'make backend' + 'make frontend'."

web-setup:
	cd web && npm install

backend:
	cd app/backend && venv/bin/uvicorn main:app --port 8001 --reload

frontend:
	cd web && npm run dev

test:
	cd app/backend && venv/bin/pytest -q

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
