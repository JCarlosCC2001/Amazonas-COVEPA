# Amazonas - COVEPA (ERP de Subsanación de Observaciones)

Sistema web integral para la programación de cuadrillas, levantamiento y subsanación de observaciones técnicas en sitios de telecomunicaciones en la **Región Amazonas (ZONA 2 y ZONA 7)**.

---

## 📖 Documentación y Contexto Maestro
Para conocer la arquitectura completa, modelos de datos, reglas de negocio y estándares del sistema, consulta el documento oficial:
👉 **[CONTEXTO_SISTEMA.md](./CONTEXTO_SISTEMA.md)**

---

## 🚀 Despliegue y Ejecución

### Desarrollo Local
```bash
npm install
npm run dev
```

### Generación de Archivos KMZ y NetworkLink
```bash
python generar_kmz.py
# O doble clic al archivo: actualizar_kmz.bat
```

### Publicación de Cambios en la Nube (Vercel)
```bash
# Doble clic al archivo:
publicar_actualizacion.bat
```

---

## 🛠️ Tecnologías Principales
- **Frontend:** React 19, Vite 8, Lucide React, ExcelJS
- **Base de Datos:** Supabase (PostgreSQL en la nube)
- **Mapas:** Google Earth (KMZ empaquetado offline y NetworkLink en vivo)
- **Hosting:** Vercel (CI/CD con GitHub)
