const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path'); // Import path module
const { Sequelize, DataTypes } = require('sequelize');

const app = express();

app.use((req, res, next) => {
  console.log(`BACKEND DEBUG: Petición global: ${req.method} ${req.originalUrl}`);
  next();
});

const PORT = process.env.PORT || 3001; // Cambiado a 3001 temporalmente

// Configuración de Sequelize para PostgreSQL
const sequelize = new Sequelize('postgresql://distrital_4_jefatura_postgres_user:kVxxkk2xSD5PBqblPlGoylfPM93khoa8@dpg-d38quqogjchc73d9cnm0-a.oregon-postgres.render.com/distrital_4_jefatura_postgres', {
  dialect: 'postgres',
  protocol: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false // Para Render.com, esto suele ser necesario
    }
  },
  logging: false // Deshabilita los logs de SQL de Sequelize
});

// Test de conexión a la base de datos
async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log('BACKEND DEBUG: Conexión a la base de datos PostgreSQL establecida exitosamente.');
  } catch (error) {
    console.error('BACKEND DEBUG: No se pudo conectar a la base de datos PostgreSQL:', error);
  }
}

connectDB();

// Middlewares
app.use(cors({
  origin: '*'
}));
app.use(express.json());

// Archivos estáticos para el frontend (sirve el build de React/Vue/Angular)
// app.use(express.static(path.join(__dirname, 'public')));

// Configuración de rutas de archivos para persistencia (eliminado, ahora usaremos DB)
// const novedadesFilePath = path.join(__dirname, 'novedades.json');
// const usersFilePath = path.join(__dirname, 'users.json');

// Clave secreta para JWT (debería ser una variable de entorno en producción)
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

// Definición del modelo User
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'user',
  },
}, {
  // Opciones del modelo
  timestamps: false, // No queremos createdAt y updatedAt
});

// Definición del modelo Novedad
const Novedad = sequelize.define('Novedad', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  fechaDelHecho: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  horaDelHecho: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  calle: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  altura: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  entreCalles: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  barrio: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  coordenadas: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  encuadreLegal: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  victima: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  edadVictima: {
    type: DataTypes.STRING,
    allowNull: true
  },
  generoVictima: {
    type: DataTypes.STRING,
    allowNull: true
  },
  observaciones: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  sumario: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  expediente: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  dependencia: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  detallesNovedad: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  lugar: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  bienAfectado: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  nombreImputado: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  esclarecidos: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  fechaCreacion: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  horaCarga: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  timestamps: false,
});

// Sincronizar modelos con la base de datos
async function syncDB() {
  try {
    await sequelize.sync({ alter: true }); // `alter: true` intentará hacer cambios no destructivos en el esquema existente
    console.log('BACKEND DEBUG: Modelos sincronizados con la base de datos.');
    
    // Asegurarse de que el usuario admin exista
    const adminUser = await User.findOne({ where: { username: 'admin' } });
    if (!adminUser) {
      const hashedPassword = await bcrypt.hash('hijoteamo2', 10); // Contraseña por defecto
      await User.create({ id: 1, username: 'admin', password: hashedPassword, role: 'admin' });
      console.log('BACKEND DEBUG: Usuario admin creado si no existía.');
    }

  } catch (error) {
    console.error('BACKEND DEBUG: Error al sincronizar modelos o crear admin:', error);
  }
}

syncDB();

// Middleware para autenticación JWT
console.log('BACKEND DEBUG: Petición recibida antes de authenticateToken.'); // Nuevo log
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

// Rutas API para Novedades
// Obtener todas las novedades
app.get('/novedades', authenticateToken, async (req, res) => {
  try {
    let novedades;
    
    // Filtrar novedades según el rol del usuario
    if (req.user.role === 'OFICIAL DE 15') {
      // Solo mostrar novedades de Comisaría 15
      novedades = await Novedad.findAll({
        where: { dependencia: 'comisaria_15' }
      });
    } else if (req.user.role === 'OFICIAL DE 20') {
      // Solo mostrar novedades de Comisaría 20
      novedades = await Novedad.findAll({
        where: { dependencia: 'comisaria_20' }
      });
    } else if (req.user.role === 'OFICIAL DE 65') {
      // Solo mostrar novedades de Comisaría 65
      novedades = await Novedad.findAll({
        where: { dependencia: 'comisaria_65' }
      });
    } else {
      // Para admin y otros roles, mostrar todas las novedades
      novedades = await Novedad.findAll();
    }
    
    res.json(novedades);
  } catch (error) {
    console.error('BACKEND DEBUG: Error al obtener novedades:', error);
    res.status(500).json({ message: 'Error interno del servidor al obtener novedades' });
  }
});

// Guardar una nueva novedad
app.post('/novedades', authenticateToken, authorizeRoles(['admin', 'user-oficiales', 'OFICIAL DE 15', 'OFICIAL DE 20', 'OFICIAL DE 65']), async (req, res) => {
  const newNovedadData = req.body;
  console.log('BACKEND DEBUG: Datos recibidos para nueva novedad:', newNovedadData); // Añadido para depuración
  try {
    const newNovedad = await Novedad.create(newNovedadData);
    res.status(201).json(newNovedad);
  } catch (error) {
    console.error('BACKEND DEBUG: Error al guardar nueva novedad:', error);
    console.error('BACKEND DEBUG: Detalles del error de la novedad:', error.message, error.errors); // Agregado para más detalles
    res.status(500).json({ message: 'Error interno del servidor al guardar novedad', details: error.message, errors: error.errors }); // Modificado para devolver detalles del error
  }
});

// Actualizar una novedad existente
app.put('/novedades/:id', authenticateToken, authorizeRoles(['admin', 'user-oficiales', 'OFICIAL DE 15', 'OFICIAL DE 20', 'OFICIAL DE 65']), async (req, res) => {
  const novedadId = req.params.id;
  const updatedNovedadData = req.body;

  try {
    const [updatedRowsCount, updatedNovedades] = await Novedad.update(updatedNovedadData, {
      where: { id: novedadId },
      returning: true, // Esto es para PostgreSQL, devuelve las filas actualizadas
    });

    if (updatedRowsCount > 0) {
      res.json(updatedNovedades[0]); // Devuelve la primera (y única) novedad actualizada
    } else {
      res.status(404).json({ message: 'Novedad no encontrada' });
    }
  } catch (error) {
    console.error('BACKEND DEBUG: Error al actualizar novedad:', error);
    console.error('BACKEND DEBUG: Detalles del error de actualización de la novedad:', error.message, error.errors); // Agregado para más detalles
    res.status(500).json({ message: 'Error interno del servidor al actualizar novedad' });
  }
});

// Eliminar una novedad
app.delete('/novedades/:id', authenticateToken, authorizeRoles(['admin', 'user-oficiales', 'OFICIAL DE 15', 'OFICIAL DE 20', 'OFICIAL DE 65']), async (req, res) => {
  const novedadId = req.params.id;

  try {
    const deletedRowCount = await Novedad.destroy({ where: { id: novedadId } });

    if (deletedRowCount > 0) {
      res.json({ message: 'Novedad eliminada exitosamente' });
    } else {
      res.status(404).json({ message: 'Novedad no encontrada' });
    }
  } catch (error) {
    console.error('BACKEND DEBUG: Error al eliminar novedad:', error);
    res.status(500).json({ message: 'Error interno del servidor al eliminar novedad' });
  }
});

// Ruta de registro
app.post('/register', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  console.log('BACKEND DEBUG: Petición de registro recibida.');
  const { username, password, role } = req.body; // Ahora podemos especificar el rol al registrar

  if (!username || !password) {
    return res.status(400).json({ message: 'Se requieren nombre de usuario y contraseña' });
  }

  try {
    const existingUser = await User.findOne({ where: { username: username } });
    if (existingUser) {
      return res.status(400).json({ message: 'El nombre de usuario ya existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ username, password: hashedPassword, role: role || 'user' });

    console.log('BACKEND DEBUG: Usuario registrado exitosamente en DB:', newUser.username);

    res.status(201).json({ message: 'Usuario registrado exitosamente', user: { id: newUser.id, username: newUser.username, role: newUser.role } });
  } catch (error) {
    console.error('BACKEND DEBUG: Error al registrar usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor al registrar usuario' });
  }
});

// Ruta de inicio de sesión
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log(`BACKEND DEBUG: Intento de login recibido - Usuario: ${username}, Contraseña: ${password}`);

  if (!username || !password) {
    console.log('BACKEND DEBUG: Faltan credenciales.');
    return res.status(400).json({ message: 'Se requieren nombre de usuario y contraseña' });
  }

  try {
    const user = await User.findOne({ where: { username: username } });
    if (!user) {
      console.log(`BACKEND DEBUG: Usuario ${username} no encontrado en DB.`);
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
  } catch (error) {
    console.error('BACKEND DEBUG: Error al iniciar sesión:', error);
    res.status(500).json({ message: 'Error interno del servidor al iniciar sesión' });
  }
});

// Ruta para eliminar un usuario (solo accesible por administradores)
app.delete('/users/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  const userId = req.params.id; // Sequelize manejará la conversión de tipo si el ID es un INTEGER

  try {
    const deletedRowCount = await User.destroy({ where: { id: userId } });

    if (deletedRowCount > 0) {
      res.json({ message: 'Usuario eliminado exitosamente' });
    } else {
      res.status(404).json({ message: 'Usuario no encontrado' });
    }
  } catch (error) {
    console.error('BACKEND DEBUG: Error al eliminar usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor al eliminar usuario' });
  }
});

// Ruta para obtener todos los usuarios (solo accesible por administradores)
app.get('/users', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  try {
    const users = await User.findAll({ attributes: { exclude: ['password'] } }); // Excluir contraseñas
    res.json(users);
  } catch (error) {
    console.error('BACKEND DEBUG: Error al obtener usuarios:', error);
    res.status(500).json({ message: 'Error interno del servidor al obtener usuarios' });
  }
});

// Ruta protegida de ejemplo (solo para administradores)
app.get('/admin-dashboard', authenticateToken, authorizeRoles(['admin']), (req, res) => {
  res.json({ message: `Bienvenido al panel de administración, ${req.user.username}!` });
});

// Ruta protegida de ejemplo (para usuarios normales y administradores)
app.get('/user-dashboard', authenticateToken, authorizeRoles(['admin', 'user']), (req, res) => {
  res.json({ message: `Bienvenido a tu panel, ${req.user.username}!` });
});

// Nuevas rutas protegidas para "Usuario-Oficiales", "admin", "OFICIAL DE 15", "OFICIAL DE 20" y "OFICIAL DE 65"
app.get('/novedades_parte', authenticateToken, authorizeRoles(['admin', 'user-oficiales', 'OFICIAL DE 15', 'OFICIAL DE 20', 'OFICIAL DE 65']), (req, res) => {
  res.json({ message: `Bienvenido a Parte de Novedades, ${req.user.username}!` });
});

app.get('/ver_novedades', authenticateToken, authorizeRoles(['admin', 'user-oficiales', 'OFICIAL DE 15', 'OFICIAL DE 20', 'OFICIAL DE 65']), (req, res) => {
  res.json({ message: `Bienvenido a Ver Partes de Novedades, ${req.user.username}!` });
});

// Ruta general (sin protección o solo para propósitos informativos)
app.get('/', (req, res) => {
  res.send('Servidor backend funcionando!');
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});