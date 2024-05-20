const mongoose = require("mongoose")

// Definición del esquema "users"
const userSchema = new mongoose.Schema({
    // Nombre del usuario
    name: {
        type: String,
        required: true,
    },
    // Correo electrónico del usuario
    email: {
        type: String,
        required: true,
        unique: true
    },
    // Contraseña del usuario
    password: {
        type: String,
        required: true,
    },
    // Lista de identificadores de tareas asociadas al usuario
    todos: [
        {
            type: mongoose.Schema.Types.ObjectId, // Tipo de dato: ObjectId
            ref: "Todo", // Referencia al modelo Todo
        }
    ],
    // Fecha de creación del usuario (automáticamente al momento de la creación)
    createdAt: {
        type: Date,
        default: Date.now // Fecha y hora actual
    }
})

// Definición del modelo User utilizando el esquema definido
const User = mongoose.model("User", userSchema)

module.exports = User
