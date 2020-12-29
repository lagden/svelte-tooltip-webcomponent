# Boilerplate Bin

Boilerplate com `Bash Script` e `Node Script` que auxiliam no desenvolvimento.

- [Boilerplate Rest](https://github.com/lagden/boilerplate-rest)
- [Boilerplate GraphQL](https://github.com/lagden/boilerplate-gql)
- [Boilerplate Svelte](https://github.com/lagden/boilerplate-svelte)


## Como usar

Se está utilizando um dos `boilerplates` acima, faça o seguinte:

```shell
cd minha_api
npx degit lagden/boilerplate-bin bin
```

## Scripts


#### deploy

Faz o cria a imagem do projeto (opcional), gera o `docker-compose.yml` de produção/staging, executa o Swarm no servidor.


#### image

Cria a imagem do projeto e envia para o `Registry`


#### pkg

Atualiza para última versão todas as dependêcias e devDependências do arquivo `package.json`.  
Mas não instala.


#### zera

Remove os `node_modules` e `package-lock.json`.  
E instala tudo novamente.


#### start

Inicia a aplicação no modo `desenvolvimento` via Docker Compose.


#### stop

Encerra a aplicação que foi inicializada via Docker Compose.


#### test

Executa o teste unitário da aplicação via Docker Compose.


#### wait

Utilizado em conjunto na propriedade `command` no `docker-compose.yml`.  
Ele testa a conexão com outra aplicação, por exemplo:

```yml
command: >
  /bin/ash -c "
    bin/wait db:3435
    node server
  "
```

A aplicação só iniciará quando o `db` estiver respondendo


#### watch

Observa os arquivos do projeto e reinicia a aplicação se houver alteração.

**Atenção!**

O `bin/watch` depende do [entr](https://github.com/eradman/entr)  
Mas é possível ajustar o para utilizar o [nodemon](https://github.com/remy/nodemon)


## License

MIT © [Thiago Lagden](https://github.com/lagden)
