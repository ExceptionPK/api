const express = require("express") // Importación del framework Express
const bodyParser = require("body-parser") // Middleware para parsear datos del cuerpo de las solicitudes HTTP
const mongoose = require("mongoose") // ODM para MongoDB
const crypto = require("crypto") // Librería para operaciones criptográficas
const sgMail = require('@sendgrid/mail') // Cliente para enviar correos electrónicos usando SendGrid
require('dotenv').config()



sgMail.setApiKey(process.env.SENDGRID_API_KEY) // Configuración de la API Key de SendGrid para enviar correos electrónicos
const app = express() // Creación de la aplicación Express
const port = process.env.PORT // Definición del puerto en el que se ejecutará el servidor

// Middleware para permitir solicitudes de recursos cruzados
const cors = require("cors")
app.use(cors())

// Middleware para parsear datos del cuerpo de las solicitudes en formato JSON
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

const jwt = require("jsonwebtoken") // Librería para crear y verificar tokens de autenticación JWT
const moment = require("moment") // Librería para manipular y formatear fechas y horas

// Conexión a la base de datos MongoDB usando Mongoose
mongoose.connect(process.env.MONGODB_CONNECT_URI).then(() => {
    console.log("Conectado a MongoDB")
}).catch((error) => {
    console.log("Error al conectar: ", error)
})

app.listen(port, () => {
    console.log("El servidor esta ejecutandose en el puerto " + port)
})

const User = require("./models/user")
const Todo = require("./models/todo")

// Manejar la solicitud de registro de un nuevo usuario
app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body

        // Verificar si ya existe un usuario con el mismo correo electrónico
        const existingUser = await User.findOne({ email })
        if (existingUser) {
            console.log("Este email ya existe")
        }

        // Crear un nuevo usuario con los datos proporcionados
        const newUser = new User({
            name,
            email,
            password
        })

        // Guardar el nuevo usuario en la base de datos
        await newUser.save()
        res.status(202).json({ message: "Usuario registrado" })
    } catch (error) {
        console.log("Error al registrar al usuario", error)
        res.status(500).json({ message: "Registro fallido" })
    }
})

// Función para generar una clave secreta aleatoria
const generateSecretKey = () => {
    // Generar una clave aleatoria utilizando el módulo crypto y convertirla a formato hexadecimal
    const secretKey = crypto.randomBytes(32).toString("hex")
    return secretKey
}

const secretKey = generateSecretKey()

// Manejar la solicitud de inicio de sesión
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body

        // Buscar el usuario en la base de datos utilizando el correo electrónico
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(401).json({ message: "El correo es incorrecto." })
        }

        // Verificar si la contraseña proporcionada coincide con la contraseña almacenada en la base de datos
        if (user.password !== password) {
            return res.status(401).json({ message: "La contraseña es incorrecta." })
        }

        // Generar un token de autenticación utilizando el ID del usuario y la clave
        const token = jwt.sign({ userId: user._id, }, secretKey)

        res.status(200).json({ token })
    } catch (error) {
        console.log("Error al iniciar sesión", error)
        res.status(500).json({ message: "Inicio de sesión fallido." })
    }
})

// Manejar la solicitud de creación de una nueva tarea para un usuario específico
app.post("/todos/:userId", async (req, res) => {
    try {
        const userId = req.params.userId
        const { title, category } = req.body

        // Crear una nueva tarea con el título, la categoría y la fecha de expiracion actuales
        const newTodo = new Todo({
            title,
            category,
            dueDate: moment().format("YYYY-MM-DD")
        })

        // Guardar la nueva tarea en la base de datos
        await newTodo.save()

        const user = await User.findById(userId)
        if (!user) {
            res.status(404).json({ error: "El usuario no se ha encontrado." })
        }

        // Añadir el ID de la nueva tarea a la lista de tareas del usuario
        user?.todos.push(newTodo._id)
        await user.save()

        res.status(200).json({ message: "La tarea se ha añadido.", todo: newTodo })
    } catch (error) {
        res.status(200).json({ message: "No se ha añadido una tarea." })
    }
})

// Recoger todas las tareas de un usuario específico
app.get("/users/:userId/todos", async (req, res) => {
    try {
        const userId = req.params.userId // Obtener el ID de usuario de los parámetros de la solicitud

        const user = await User.findById(userId).populate("todos")
        if (!user) {
            return res.status(404).json({ error: "El usuario no se ha encontrado." })
        }

        res.status(200).json({ todos: user.todos })
    } catch (error) {
        res.status(500).json({ message: "Algo ha ido mal" })
    }
})

// Marcar una tarea como completada
app.patch("/todos/:todoId/complete", async (req, res) => {
    try {
        const todoId = req.params.todoId // Obtener el ID de la tarea de los parámetros de la solicitud

        const updatedTodo = await Todo.findByIdAndUpdate(todoId, {
            status: "completed"
        }, { new: true } // Devolver los datos actualizados
        )

        if (!updatedTodo) {
            return res.status(404).json({ error: "No se ha encontrado la tarea" })
        }

        res.status(200).json({ message: "Tarea marcada como completada", todo: updatedTodo })
    } catch (error) {
        res.status(500).json({ message: "Algo ha ido mal" })
    }
})

// Obtener las tareas completadas de un usuario en una fecha específica
app.get("/users/:userId/todos/completed/:date", async (req, res) => {
    try {
        const userId = req.params.userId // Obtener el ID de usuario de los parámetros de la solicitud
        const date = req.params.date // Obtener la fecha de los parámetros de la solicitud

        // Buscar al usuario por su ID
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({ error: "El usuario no se ha encontrado." })
        }

        // Buscar las tareas completadas del usuario en la fecha especificada
        const completedTodos = await Todo.find({
            _id: { $in: user.todos }, // Filtrar por las tareas del usuario
            status: "completed", // Filtrar por tareas completadas
            createdAt: {
                $gte: new Date(`${date}T00:00:00.000Z`),
                $lt: new Date(`${date}T23:59:59.999Z`),
            },
        }).exec()

        res.status(200).json({ completedTodos })
    } catch (error) {
        res.status(500).json({ error: "Algo ha ido mal" })
    }
})

// Obtener el número total de tareas completadas y pendientes de un usuario
app.get("/users/:userId/todos/count", async (req, res) => {
    try {
        const userId = req.params.userId // Obtener el ID de usuario de los parámetros de la solicitud

        // Buscar al usuario por su ID
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({ error: "El usuario no se ha encontrado." })
        }

        // Contar el número de tareas completadas del usuario
        const totalCompletedTodos = await Todo.countDocuments({
            _id: { $in: user.todos },
            status: "completed",
        }).exec()

        // Contar el número de tareas pendientes del usuario
        const totalPendingTodos = await Todo.countDocuments({
            _id: { $in: user.todos },
            status: "pending",
        }).exec()

        res.status(200).json({ totalCompletedTodos, totalPendingTodos })
    } catch (error) {
        res.status(500).json({ error: "Error en la conexión." })
    }
})

// Eliminar una tarea específica
app.delete("/todos/:todoId", async (req, res) => {
    try {
        const todoId = req.params.todoId

        // Eliminar la tarea de la base de datos
        const deletedTodo = await Todo.findByIdAndDelete(todoId)
        if (!deletedTodo) {
            return res.status(404).json({ error: "La tarea no se ha encontrado." })
        }

        // Buscar al usuario que tiene la tarea y eliminar la referencia de la tarea de su lista de tareas
        const user = await User.findOneAndUpdate(
            { todos: todoId }, // Buscar al usuario que tiene la tarea en su lista de tareas
            { $pull: { todos: todoId } }, // Eliminar la referencia de la tarea de la lista de tareas del usuario
            { new: true } // Devolver los datos actualizados del usuario
        )

        if (!user) {
            return res.status(404).json({ error: "El usuario no se ha encontrado." })
        }

        res.status(200).json({ message: "Tarea eliminada correctamente." })
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: "Error al eliminar la tarea." })
    }
})

// Ruta para eliminar todas las tareas de un usuario
app.delete("/todos/delete-all/:userId", async (req, res) => {
    try {
        const userId = req.params.userId // Obtener el ID de usuario de los parámetros de la solicitud

        // Buscar al usuario por su ID
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({ error: "El usuario no se ha encontrado." })
        }

        // Eliminar todas las tareas del usuario de la base de datos
        const deletedTodos = await Todo.deleteMany({ _id: { $in: user.todos } })
        if (!deletedTodos) {
            return res.status(404).json({ error: "No se han encontrado tareas para eliminar." })
        }

        // Limpiar la lista de tareas del usuario
        user.todos = []
        await user.save() // Guardar los cambios en el usuario

        res.status(200).json({ message: "Todas las tareas han sido eliminadas." })
    } catch (error) {
        console.log("Error al eliminar todas las tareas:", error)
        res.status(500).json({ title: "Error al borrar", message: "Error al eliminar todas las tareas." })
    }
})

// Ruta para enviar un correo electrónico de recuperación de contraseña
app.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body // Obtener el correo electrónico del cuerpo de la solicitud

        // Buscar al usuario por su correo electrónico
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(404).json({ title: "Error de datos", message: "El correo electrónico no está registrado." })
        }

        // Crear el mensaje de correo electrónico para la recuperación de contraseña
        const msg = {
            to: email,
            from: { name: 'no-reply', email: 'chumakeriker@gmail.com' },
            subject: "Recuperación de contraseña",
            text: `
                Estimado usuario,
        
                Hemos recibido una solicitud para restablecer la contraseña asociada a tu cuenta. 
                Si no has solicitado este cambio, puedes ignorar este mensaje con tranquilidad.
        
                Para restablecer tu contraseña, haz clic en el siguiente enlace:
                [Enlace para restablecer contraseña]
        
                Si el botón de arriba no funciona, copia y pega la siguiente URL en tu navegador web:
                [URL de restablecimiento de contraseña]
        
                Atentamente,
                El equipo de soporte técnico
            `,
            html: `
                <div style="font-family: Arial, sans-serif max-width: 600px margin: 0 auto">
                    <p style="font-size: 16px line-height: 1.6">
                        Estimado usuario,
                    </p>
                    <p style="font-size: 16px line-height: 1.6">
                        Hemos recibido una solicitud para restablecer la contraseña asociada a tu cuenta. 
                        Si no has solicitado este cambio, puedes ignorar este mensaje con tranquilidad.
                    </p>
                    <p style="font-size: 16px line-height: 1.6">
                        Para restablecer tu contraseña, haz clic en el siguiente enlace:
                        <a href="[Enlace para restablecer contraseña]" style="color: #406ef2">Restablecer contraseña</a>
                    </p>
                    <p style="font-size: 16px line-height: 1.6">
                        Si el botón de arriba no funciona, copia y pega la siguiente URL en tu navegador web:
                        [URL de restablecimiento de contraseña]
                    </p>
                    <p style="font-size: 16px line-height: 1.6">
                        Atentamente,<br>
                        El equipo de soporte técnico
                    </p>
                </div>
            `
        }
        
        // Enviar el correo electrónico utilizando el servicio de SendGrid
        await sgMail.send(msg)

        res.status(200).json({ title: "Recuperación de contraseña", message: "Se ha enviado un correo electrónico de recuperación de contraseña." })
    } catch (error) {
        console.log("Error al enviar el correo electrónico de recuperación de contraseña:", error)
        res.status(500).json({ title: "Error de envío", message: "Hubo un error al enviar el correo electrónico de recuperación de contraseña." })
    }
})

