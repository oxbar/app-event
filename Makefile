.PHONY: up down reset test backend-test frontend-test validate zip
up:
	docker compose up --build
down:
	docker compose down
reset:
	docker compose down -v --remove-orphans
backend-test:
	cd backend && mvn clean verify
frontend-test:
	cd frontend && npm install && npm run lint && npm run test && npm run build
validate:
	python3 infrastructure/scripts/validate-project.py

test: validate backend-test frontend-test
zip:
	cd .. && zip -r event-access-platform.zip event-access-platform -x '*/target/*' '*/node_modules/*' '*/dist/*'
