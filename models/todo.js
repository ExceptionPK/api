const mongoose = require("mongoose")

// Definición del esquema "todos"
const todoSchema = new mongoose.Schema({
    // Título de la tarea
    title: {
        type: String,
        required: true
    },
    // Estado de la tarea (pendiente o completada)
    status: {
        type: String,
        enum: ["pending", "completed"],
        default: "pending"
    },
    // Categoría de la tarea
    category: {
        type: String,
        required: true,
    },
    // Fecha de vencimiento de la tarea
    dueDate: {
        type: String,
        required: true
    },
    // Fecha de creación de la tarea (se establece automáticamente al momento de la creación)
    createdAt: {
        type: Date,
        default: Date.now
    }
})

// Definición del modelo Todo utilizando el esquema definido
const Todo = mongoose.model("Todo", todoSchema)

module.exports = Todo