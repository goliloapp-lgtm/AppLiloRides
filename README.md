# Lilo - Aplicación de Transporte

Una aplicación móvil de transporte desarrollada con React Native, Expo y Firebase.

## 🚀 Tecnologías Utilizadas

- **React Native** con Expo
- **Firebase Authentication** para autenticación de usuarios
- **NativeWind** (Tailwind CSS para React Native) para estilos
- **React Navigation** para navegación
- **Zustand** para manejo de estado
- **Formik + Yup** para validación de formularios
- **React Native Maps** para funcionalidad de mapas

## 📱 Funcionalidades

### Autenticación
- ✅ Registro de usuarios con email y contraseña
- ✅ Inicio de sesión con email y contraseña
- ✅ **Recuperación de contraseña por email** (Implementado)
- ✅ Cierre de sesión
- ✅ Persistencia de sesión

### Recuperación de Contraseña
La funcionalidad de recuperación de contraseña ha sido completamente implementada:

1. **Interfaz de usuario mejorada**: Pantalla dedicada con formulario de email
2. **Validación de email**: Usando Yup para validar formato de email
3. **Integración con Firebase**: Usa `sendPasswordResetEmail` de Firebase Auth
4. **Manejo de errores**: Mensajes específicos para diferentes tipos de errores
5. **Confirmación visual**: Pantalla de confirmación cuando el email se envía exitosamente
6. **Navegación fluida**: Opciones para volver al login o enviar otro email

### Gestión de Perfiles
- ✅ **Perfiles de usuario con Firestore** (Implementado)
- ✅ **Sistema de cache inteligente** (Optimizado)
- ✅ **Carga automática y actualización** (Implementado)
- ✅ **Pull-to-refresh y actualización manual** (Implementado)

### Otras Funcionalidades
- 🗺️ Integración con mapas
- 📍 Geolocalización
- 🚗 Gestión de viajes

## 🏗️ Estructura del Proyecto

```
lilo/
├── components/
│   ├── auth/
│   │   ├── Auth.js          # Componente principal de autenticación
│   │   ├── Login.js         # Pantalla de inicio de sesión
│   │   ├── Register.js      # Pantalla de registro
│   │   └── Password.js      # Pantalla de recuperación de contraseña ✨
│   ├── Map.js
│   ├── Tabs.js
│   └── ...
├── lib/
│   ├── auth.js              # Utilidades de autenticación Firebase ✨
│   └── context/
│       └── AuthContext.js   # Contexto de autenticación
├── screens/
│   ├── Home.js
│   └── Profile.js
├── firebase-config.js       # Configuración de Firebase
└── App.js                   # Componente principal
```

## 🔧 Instalación y Configuración

1. **Clonar el repositorio**
```bash
git clone [url-del-repositorio]
cd lilo
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar Firebase**
   - Crear un proyecto en Firebase Console
   - Habilitar Authentication con Email/Password
   - Actualizar `firebase-config.js` con tus credenciales

4. **Ejecutar la aplicación**
```bash
npm start
```

## 🔐 Funcionalidad de Recuperación de Contraseña

### Flujo de Usuario
1. Usuario hace clic en "Forgot password?" en la pantalla de login
2. Se navega a la pantalla de recuperación de contraseña
3. Usuario ingresa su email y hace clic en "Send Reset Email"
4. Se envía un email de recuperación usando Firebase Auth
5. Se muestra pantalla de confirmación con opciones para:
   - Volver al login
   - Enviar otro email

### Implementación Técnica

#### `lib/auth.js` - Función de Utilidad
```javascript
export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    // Manejo específico de errores
    return { success: false, error: errorMessage };
  }
};
```

#### `components/auth/Password.js` - Componente UI
- Formulario con validación de email
- Estados de loading y confirmación
- Manejo de errores con Toast notifications
- Interfaz responsive con NativeWind

### Manejo de Errores
La aplicación maneja específicamente estos errores de Firebase:
- `auth/invalid-email`: Email inválido
- `auth/user-not-found`: Usuario no encontrado
- `auth/too-many-requests`: Demasiadas solicitudes
- `auth/network-request-failed`: Error de red

## 🎨 Diseño y UX

- **Colores**: Esquema de colores consistente usando Tailwind
- **Iconos**: Material Community Icons para elementos visuales
- **Feedback**: Toast notifications para confirmaciones y errores
- **Responsive**: Diseño adaptable para diferentes tamaños de pantalla

## 📋 Scripts Disponibles

- `npm start`: Inicia el servidor de desarrollo de Expo
- `npm run android`: Ejecuta en emulador Android
- `npm run ios`: Ejecuta en simulador iOS
- `npm run web`: Ejecuta en navegador web

## 🔄 Estado de Autenticación

El estado de autenticación se maneja globalmente usando:
- **AuthContext**: Contexto React para estado global
- **Firebase Auth State**: Persistencia automática de sesión
- **Zustand**: Para estado adicional de la aplicación

## 🚀 Próximas Mejoras

- [ ] Autenticación con Google
- [ ] Autenticación con redes sociales
- [ ] Verificación de email
- [ ] Cambio de contraseña desde perfil
- [ ] Autenticación de dos factores

## 📝 Notas de Desarrollo

- La aplicación usa Firebase Auth v9+ con sintaxis modular
- Persistencia de autenticación configurada con AsyncStorage
- Validación de formularios con Yup
- Estilos con NativeWind (Tailwind CSS)

---

**Desarrollado con ❤️ usando React Native y Firebase** 