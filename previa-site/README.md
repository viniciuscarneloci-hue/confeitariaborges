# previa-site

Site de divulgação da Previa: cardápio em 3D e RA, sites, pedidos e plaquinhas NFC/QR para restaurantes.

```bash
npm install
npm run dev                    # http://localhost:4321
npm run build                  # gera dist/
npm run build:claude-preview   # gera dist-preview/ para a prévia no Claude (modelos em .b64.json)
```

- Deploy: projeto separado na Vercel com Root Directory `previa-site`.
- WhatsApp do formulário de contato: variável `PUBLIC_WHATSAPP` (só dígitos, com DDI, ex. 5511999999999).
- Pratos da demonstração: `src/scripts/models.ts` e `public/models/*.glb` (os mesmos do protótipo `oak-ar`).
- Identidade: manual de marca Previa v1.3 (tokens em `src/styles/global.css`).
