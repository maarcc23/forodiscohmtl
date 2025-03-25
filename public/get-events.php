<?php
// Configuración de cabeceras para permitir CORS
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

// Configuración de la base de datos
$servername = "localhost";
$username = "root"; // Cambia esto por tu usuario de base de datos
$password = ""; // Cambia esto por tu contraseña de base de datos
$dbname = "forodiscohmtl"; // Cambia esto por el nombre de tu base de datos

// Crear conexión
$conn = new mysqli($servername, $username, $password, $dbname);

// Verificar conexión
if ($conn->connect_error) {
    echo json_encode(["error" => "Conexión fallida: " . $conn->connect_error]);
    exit;
}

// Consulta SQL para obtener los eventos
$sql = "SELECT e.*, v.name as venue_name 
        FROM events e 
        LEFT JOIN venues v ON e.venue_id = v.id 
        ORDER BY e.event_date ASC";

$result = $conn->query($sql);

// Crear array para almacenar los eventos
$events = [];

// Obtener los datos
if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $events[] = $row;
    }
} else {
    // Si no hay eventos, devolver un array vacío
    $events = [];
}

// Cerrar conexión
$conn->close();

// Devolver los eventos en formato JSON
echo json_encode($events);
?>