# Ativar login e sincronização da LOVYNNI

1. Crie **seu próprio projeto** em https://console.firebase.google.com/ (não utilize o projeto Maylas).
2. Em **Authentication > Sign-in method**, habilite **E-mail/senha**.
3. Em **Authentication > Settings > Authorized domains**, autorize o domínio de hospedagem (e localhost para testes, se necessário).
4. Crie um banco **Cloud Firestore**. Em **Rules**, substitua pelas regras de `firestore.rules` e publique.
5. Em **Project settings > Your apps**, registre um app Web e copie os valores de `firebaseConfig` para `firebase-config.js`.
6. Abra o projeto com Live Server ou publique em HTTPS. Não use `file://`.
7. Teste com duas contas diferentes para verificar que cada uma vê apenas seus próprios favoritos e sacola.

## Comportamento

- Antes de configurar: favoritos e sacola permanecem apenas neste navegador; cadastro/login ficam desativados.
- Após configurar: login e cadastro com e-mail e senha reais; favoritos e sacola são salvos no Firestore em `users/{uid}` e recuperados após login em outro dispositivo.
- Os dados do visitante não são automaticamente transferidos para uma conta; cada nova conta começa vazia.
- Histórico de pedidos, pagamento, frete e checkout são **funcionalidades futuras**; nenhum pagamento é processado.
- O painel `admin.html` continua **demonstrativo** e não é um painel de administração seguro para produção.
- Antes de lançar, implemente política de privacidade, proteção antiabuso, regras mais restritas com validação de campos, checkout com provedor de pagamento e gestão de pedidos por backend confiável.
