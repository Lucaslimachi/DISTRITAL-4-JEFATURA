const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs'); // Import the file system module
const path = require('path'); // Import path module
const app = express();
const PORT = process.env.PORT || 3001; // Cambiado a 3001 temporalmente

const novedadesFilePath = path.join(__dirname, 'novedades.json');
const usersFilePath = path.join(__dirname, 'users.json');

// Usuarios en memoria (simulando una base de datos)
// const users = [
//   { id: 1, username: 'admin', password: '$2b$10$RUpwExm7ZRkki8L6blId9ev3EYdDzGfXza98mGdZemSICPbUrqC32', role: 'admin' } // Contraseña: hijoteamo2
// ]; // { username, password, role: 'user' | 'admin' }

// Clave secreta para JWT (debería ser una variable de entorno en producción)
const JWT_SECRET = 'supersecretkey'; 

// Funciones auxiliares para leer y escribir novedades
function readNovedades() {
  if (fs.existsSync(novedadesFilePath)) {
    const data = fs.readFileSync(novedadesFilePath, 'utf8');
    return JSON.parse(data);
  } 
  return [];
}

function writeNovedades(novedades) {
  fs.writeFileSync(novedadesFilePath, JSON.stringify(novedades, null, 2), 'utf8');
}

// Funciones auxiliares para leer y escribir usuarios
function readUsers() {
  console.log('BACKEND DEBUG: Intentando leer usuarios de:', usersFilePath);
  if (fs.existsSync(usersFilePath)) {
    const data = fs.readFileSync(usersFilePath, 'utf8');
    const users = JSON.parse(data);
    console.log('BACKEND DEBUG: Usuarios leídos (después de parsear): ', users.map(u => u.username));
    return users;
  }
  console.log('BACKEND DEBUG: El archivo de usuarios no existe, inicializando con usuario admin.');
  const initialUsers = [
    { id: 1, username: 'admin', password: '$2b$10$RUpwExm7ZRkki8L6blId9ev3EYdDzGfXza98mGdZemSICPbUrqC32', role: 'admin' } // Contraseña: hijoteamo2
  ];
  writeUsers(initialUsers);
  return initialUsers;
}

function writeUsers(users) {
  console.log('BACKEND DEBUG: Intentando escribir usuarios en:', usersFilePath);
  console.log('BACKEND DEBUG: Usuarios a escribir:', users.map(u => u.username));
  fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
  console.log('BACKEND DEBUG: Usuarios escritos exitosamente.');
}

// Middleware para autenticación JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401); // Si no hay token, acceso no autorizado

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // Token inválido o expirado
    req.user = user;
    next();
  });
}

// Middleware para autorización de roles
function authorizeRoles(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Acceso denegado: rol insuficiente' });
    }
    next();
  };
}

app.use(cors());
app.use(express.json());

// Rutas API para Novedades
// Obtener todas las novedades
app.get('/novedades', authenticateToken, (req, res) => {
  const novedades = readNovedades();
  res.json(novedades);
});

// Guardar una nueva novedad
app.post('/novedades', authenticateToken, authorizeRoles(['admin', 'user-oficiales']), (req, res) => {
  const newNovedad = req.body;
  const novedades = readNovedades();
  newNovedad.id = Date.now().toString(); // Asignar un ID único
  novedades.push(newNovedad);
  writeNovedades(novedades);
  res.status(201).json(newNovedad);
});

// Actualizar una novedad existente
app.put('/novedades/:id', authenticateToken, authorizeRoles(['admin', 'user-oficiales']), (req, res) => {
  const novedadId = req.params.id;
  const updatedNovedad = req.body;
  let novedades = readNovedades();
  
  const index = novedades.findIndex(n => n.id === novedadId);
  if (index !== -1) {
    novedades[index] = { ...novedades[index], ...updatedNovedad, id: novedadId }; // Asegurar que el ID no cambie
    writeNovedades(novedades);
    res.json(novedades[index]);
  } else {
    res.status(404).json({ message: 'Novedad no encontrada' });
  }
});

// Eliminar una novedad
app.delete('/novedades/:id', authenticateToken, authorizeRoles(['admin', 'user-oficiales']), (req, res) => {
  const novedadId = req.params.id;
  let novedades = readNovedades();

  const initialLength = novedades.length;
  novedades = novedades.filter(n => n.id !== novedadId);
  
  if (novedades.length < initialLength) {
    writeNovedades(novedades);
    res.json({ message: 'Novedad eliminada exitosamente' });
  } else {
    res.status(404).json({ message: 'Novedad no encontrada' });
  }
});

// Ruta de registro
app.post('/register', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  const { username, password, role } = req.body; // Ahora podemos especificar el rol al registrar

  if (!username || !password) {
    return res.status(400).json({ message: 'Se requieren nombre de usuario y contraseña' });
  }

  const users = readUsers(); // Leer usuarios
  const existingUser = users.find(u => u.username === username);
  if (existingUser) {
    return res.status(400).json({ message: 'El nombre de usuario ya existe' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  // El rol ahora puede ser especificado por el admin, si no, por defecto 'user'
  const newUser = { id: users.length + 1, username, password: hashedPassword, role: role || 'user' }; 
  users.push(newUser);
  writeUsers(users); // Escribir usuarios actualizados
  console.log('BACKEND DEBUG: Estado de usuarios después del registro:', users.map(u => u.username));

  res.status(201).json({ message: 'Usuario registrado exitosamente', user: { id: newUser.id, username: newUser.username, role: newUser.role } });
});

// Ruta de inicio de sesión
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log(`BACKEND DEBUG: Intento de login recibido - Usuario: ${username}, Contraseña: ${password}`);

  if (!username || !password) {
    console.log('BACKEND DEBUG: Faltan credenciales.');
    return res.status(400).json({ message: 'Se requieren nombre de usuario y contraseña' });
  }

  const users = readUsers(); // Leer usuarios
  console.log('BACKEND DEBUG: Usuarios cargados para login:', users.map(u => u.username));
  const user = users.find(u => u.username === username);
  if (!user) {
    console.log(`BACKEND DEBUG: Usuario ${username} no encontrado.`);
    return res.status(401).json({ message: 'Credenciales inválidas' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    console.log(`BACKEND DEBUG: Contraseña incorrecta para el usuario ${username}.`);
    return res.status(401).json({ message: 'Credenciales inválidas' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  console.log(`BACKEND DEBUG: Login exitoso para el usuario ${username}.`);
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

// Ruta para eliminar un usuario (solo accesible por administradores)
app.delete('/users/:id', authenticateToken, authorizeRoles(['admin']), (req, res) => {
  const userId = parseInt(req.params.id);
  let users = readUsers(); // Leer usuarios

  const initialLength = users.length;
  users = users.filter(user => user.id !== userId);

  if (users.length < initialLength) {
    writeUsers(users); // Escribir usuarios actualizados
    res.json({ message: 'Usuario eliminado exitosamente' });
  } else {
    res.status(404).json({ message: 'Usuario no encontrado' });
  }
});

// Ruta para obtener todos los usuarios (solo accesible por administradores)
app.get('/users', authenticateToken, authorizeRoles(['admin']), (req, res) => {
  const users = readUsers(); // Leer usuarios
  // Excluir contraseñas de la respuesta
  const usersWithoutPasswords = users.map(user => {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  });
  res.json(usersWithoutPasswords);
});

// Ruta protegida de ejemplo (solo para administradores)
app.get('/admin-dashboard', authenticateToken, authorizeRoles(['admin']), (req, res) => {
  res.json({ message: `Bienvenido al panel de administración, ${req.user.username}!` });
});

// Ruta protegida de ejemplo (para usuarios normales y administradores)
app.get('/user-dashboard', authenticateToken, authorizeRoles(['admin', 'user']), (req, res) => {
  res.json({ message: `Bienvenido a tu panel, ${req.user.username}!` });
});

// Nuevas rutas protegidas para "Usuario-Oficiales" y "admin"
app.get('/novedades_parte', authenticateToken, authorizeRoles(['admin', 'user-oficiales']), (req, res) => {
  res.json({ message: `Bienvenido a Parte de Novedades, ${req.user.username}!` });
});

app.get('/ver_novedades', authenticateToken, authorizeRoles(['admin', 'user-oficiales']), (req, res) => {
  res.json({ message: `Bienvenido a Ver Partes de Novedades, ${req.user.username}!` });
});

// Ruta general (sin protección o solo para propósitos informativos)
app.get('/', (req, res) => {
  res.send('Servidor backend funcionando!');
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});