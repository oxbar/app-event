# v6.3.2

- Corrige o empacotamento Docker do backend.
- O Dockerfile não depende mais do nome exato do artefato Maven.
- O JAR gerado pelo Maven é detectado e copiado para `target/app.jar`.
- A imagem final copia sempre `/app/target/app.jar`.
- Define `DEBIAN_FRONTEND=noninteractive` para evitar avisos interativos do APT durante o build.
