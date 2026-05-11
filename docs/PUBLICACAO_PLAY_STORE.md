# Publicacao Android - Sabor Caseiro

Guia rapido para gerar e publicar o app Android do `Sabor Caseiro`.

## Identidade atual

- Nome do app: `Sabor Caseiro`
- App ID: `br.com.saborcaseiro.app`
- Versao web/nativa centralizada em `package.json`
- Tema e splash nativos configurados no projeto Android

## Antes de gerar a versao de loja

Confira estes pontos:

1. O site precisa estar funcionando em producao com HTTPS.
2. Pagamentos devem estar testados no tenant correto.
3. Entregas, taxa, horario e cardapio precisam estar revisados no admin.
4. O `JAVA_HOME` da maquina precisa apontar para um JDK valido.
5. Se for publicar atualizacao, aumente o `versionCode`.

## Como funciona a versao do app

- `versionName`: por padrao usa a versao do [package.json](/C:/Dev/minas/package.json:1)
- `versionCode`: por padrao usa `1`
- Para novas publicacoes na Play Store, o `versionCode` precisa sempre subir

Exemplo no PowerShell:

```powershell
$env:ANDROID_VERSION_CODE='2'
$env:ANDROID_VERSION_NAME='1.0.1'
npm run build:android
cd android
.\gradlew.bat bundleRelease
```

## Gerar APK de teste

```powershell
npm run build:android
cd android
$env:JAVA_HOME='C:\Program Files\Java\jdk-23'
.\gradlew.bat assembleDebug
```

Arquivo gerado:

- [app-debug.apk](/C:/Dev/minas/android/app/build/outputs/apk/debug/app-debug.apk)

## Gerar AAB para Play Store

O formato recomendado para publicacao e `AAB`.

Passos:

1. Criar ou usar uma keystore de producao.
2. Configurar a assinatura no Android Studio, em `android/keystore.properties` ou por variaveis de ambiente.
3. Rodar `bundleRelease`.
4. Enviar o `.aab` no Google Play Console.

Comando:

```powershell
npm run build:android
cd android
$env:JAVA_HOME='C:\Program Files\Java\jdk-23'
.\gradlew.bat bundleRelease
```

Saida esperada:

- `android/app/build/outputs/bundle/release/app-release.aab`

## Assinatura do app

Opcao 1: arquivo local fora do Git

1. Copie [android/keystore.properties.example](/C:/Dev/minas/android/keystore.properties.example:1) para `android/keystore.properties`
2. Preencha o caminho do `.jks`, alias e senhas
3. Rode a build de release

Opcao 2: variaveis de ambiente

```powershell
$env:ANDROID_KEYSTORE_PATH='C:\chaves\sabor-caseiro-upload.jks'
$env:ANDROID_KEYSTORE_PASSWORD='sua-senha'
$env:ANDROID_KEY_ALIAS='upload'
$env:ANDROID_KEY_PASSWORD='sua-senha'
```

## Criar keystore de upload

Exemplo com `keytool`:

```powershell
keytool -genkeypair -v -keystore sabor-caseiro-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Guarde esse arquivo e as senhas com muito cuidado. Para publicacoes futuras, a mesma chave sera necessaria.

## Checklist Play Store

1. Nome, descricao curta e descricao completa do app
2. Icone final em alta resolucao
3. Capturas de tela do app no celular
4. Politica de privacidade publicada
5. Email de suporte
6. Categoria do app
7. Faixa etaria / classificacao de conteudo
8. Declaracao sobre dados coletados e pagamentos
9. Teste completo de pedido, pagamento e impressao
10. Revisao final de endereco, WhatsApp e taxas de entrega

Textos de apoio prontos:

- [docs/PLAY_STORE_ASSETS.md](/C:/Dev/minas/docs/PLAY_STORE_ASSETS.md:1)
- [docs/POLITICA_PRIVACIDADE_SABOR_CASEIRO.md](/C:/Dev/minas/docs/POLITICA_PRIVACIDADE_SABOR_CASEIRO.md:1)
- [docs/ROTEIRO_CAPTURAS_PLAY_STORE.md](/C:/Dev/minas/docs/ROTEIRO_CAPTURAS_PLAY_STORE.md:1)
- [docs/ENVIO_FINAL_PLAY_STORE.md](/C:/Dev/minas/docs/ENVIO_FINAL_PLAY_STORE.md:1)

URL publica da politica no site:

- `/politica-privacidade.html`

## Pendencias recomendadas antes da publicacao final

- Trocar os PNGs legados do launcher por exportacoes finais da marca
- Configurar assinatura de release
- Gerar capturas reais do app em uso
- Revisar textos comerciais e politica de privacidade
