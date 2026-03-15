import React from 'react'
import data from './data.json'
import strings from './strings.json'

function App() {
  const unitID = "4"; // Arquero
  const unidad = data.data.units[unitID];

  // 1. Buscamos el nombre
  const nameID = unidad.LanguageNameId; 
  const nombreReal = strings[nameID] || unidad.internal_name;
  
  // 2. Buscamos la descripción
  const helpID = unidad.LanguageHelpId;
  const descripcion = strings[helpID]; 

  return (
    <div style={{ 
      backgroundColor: '#222', 
      color: 'white', 
      minHeight: '100vh', 
      padding: '50px', 
      fontFamily: 'Segoe UI, sans-serif' 
    }}>
      <h1>Entrenador AoE2</h1>
      
      <div style={{ 
        border: '1px solid #555', 
        padding: '20px', 
        borderRadius: '10px', 
        maxWidth: '400px',
        backgroundColor: '#333'
      }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {/* 3. CORRECCIÓN IMAGEN: Chequea si tu carpeta en public es 'units' o 'Units' */}
            <img 
              src={`/img/Units/${unitID}.png`} 
              alt={nombreReal}
              style={{ width: '64px', height: '64px', border: '2px solid gold' }}
              // Esto ayuda a depurar: si falla, te avisa en la consola
              onError={(e) => {
                  e.target.style.display = 'none'; 
                  console.error("No encontré la imagen en: ", e.target.src);
              }}
            />
            <h2>{nombreReal}</h2>
        </div>
        
        <hr style={{ borderColor: '#555' }}/>
        
        {/* 4. CORRECCIÓN TEXTO: Renderizar HTML real */}
        <p 
            style={{ fontSize: '0.9em', lineHeight: '1.5' }}
            dangerouslySetInnerHTML={{ __html: descripcion }} 
        />

        <div style={{ marginTop: '20px', fontWeight: 'bold' }}>
            <p>❤️ HP: {unidad.HP}</p>
            <p>⚔️ Ataque: {unidad.Attack}</p>
        </div>
      </div>
    </div>
  )
}

export default App