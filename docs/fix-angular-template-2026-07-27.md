# Correção do build Angular — 27/07/2026

O compilador Angular não permite arrow functions diretamente nas expressões de template.

Foram substituídas as expressões:

- `showForm.update(value => !value)` por `toggleForm()`;
- `showPassword.update(value => !value)` por `togglePassword()`;
- `menu.update(value => !value)` por `toggleMenu()`.

A atualização dos signals permanece nos métodos TypeScript dos componentes.
