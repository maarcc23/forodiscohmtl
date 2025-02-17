document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  console.log('Sending registration data:', { username, email }); // No logues la contraseña

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await response.json();
    console.log('Registration response:', data);

    if (data.success) {
      alert('Registration successful!');
      // Redirigir al usuario o actualizar la UI
    } else {
      alert(`Registration failed: ${data.message}`);
    }
  } catch (error) {
    console.error('Error during registration:', error);
    alert('An error occurred during registration. Please try again.');
  }
});
