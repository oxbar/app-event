#!/usr/bin/env python3
from __future__ import annotations
import json, re, sys, xml.etree.ElementTree as ET
from pathlib import Path
import yaml
ROOT=Path(__file__).resolve().parents[2]
errors=[]; checks=[]
def ok(name, condition, detail=''):
    checks.append((name,condition,detail))
    if not condition: errors.append(f'{name}: {detail}')
required=['backend/pom.xml','backend/Dockerfile','frontend/package.json','frontend/angular.json','frontend/Dockerfile','frontend/nginx.conf','docker-compose.yml','.env.example','README.md','docs/architecture.md','docs/database.md','docs/api.md','docs/payment-flow.md','docs/checkin-flow.md']
for rel in required: ok(f'arquivo {rel}',(ROOT/rel).is_file(),'ausente')
for p in ROOT.rglob('*.json'):
    try: json.loads(p.read_text(encoding='utf-8'))
    except Exception as e: errors.append(f'JSON inválido {p.relative_to(ROOT)}: {e}')
for p in [ROOT/'docker-compose.yml',ROOT/'backend/src/main/resources/application.yml']:
    try: yaml.safe_load(p.read_text(encoding='utf-8'))
    except Exception as e: errors.append(f'YAML inválido {p.relative_to(ROOT)}: {e}')
try: ET.parse(ROOT/'backend/pom.xml')
except Exception as e: errors.append(f'pom.xml inválido: {e}')
package=json.loads((ROOT/'frontend/package.json').read_text())
all_deps={**package.get('dependencies',{}),**package.get('devDependencies',{})}
for forbidden in ['@angular/material','bootstrap','primeng','@nebular/theme','ng-zorro-antd']:
    ok(f'sem {forbidden}',forbidden not in all_deps,'dependência concorrente detectada')
ts='\n'.join(p.read_text(errors='ignore') for p in (ROOT/'frontend/src').rglob('*.ts'))
ok('URLs relativas no Angular','http://localhost:8080' not in ts,'URL absoluta encontrada')
code_roots=[ROOT/'backend/src',ROOT/'frontend/src']
source='\n'.join(p.read_text(errors='ignore') for root in code_roots for p in root.rglob('*') if p.is_file() and p.suffix in {'.java','.ts','.sql','.yml','.scss','.html'})
for token in ['TODO','UnsupportedOperationException','console.log(']: ok(f'sem {token}',token not in source,'placeholder crítico encontrado')
sql=(ROOT/'backend/src/main/resources/db/migration/V1__schema.sql').read_text()
for table in ['organizations','users','organization_members','events','ticket_types','attendees','orders','order_items','payments','payment_webhooks','tickets','invitations','access_points','event_staff','checkins','refunds','audit_logs']:
    ok(f'tabela {table}',bool(re.search(rf'CREATE TABLE {table}\s*\(',sql,re.I)),'não criada')
ok('check-in atômico',"WHERE id=:ticketId AND status='VALID'" in source,'update atômico ausente')
ok('token de QR opaco','HmacSHA256' in source and 'qr_token_hash' in sql,'estratégia de token ausente')
ok('isolamento por organização','organizationId' in source and 'findByIdAndOrganizationId' in source,'filtro de tenant ausente')
print('VALIDAÇÃO ESTRUTURAL')
for name,passed,detail in checks: print(('OK   ' if passed else 'FALHA')+name+(f' — {detail}' if detail and not passed else ''))
print(f'\n{len(checks)-len(errors)}/{len(checks)} verificações aprovadas')
if errors:
    print('\nErros:'); [print('-',e) for e in errors]; sys.exit(1)
