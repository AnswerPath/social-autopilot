import fs from 'fs'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
}

async function runSqlSetup() {
  console.log('🚀 Running SQL setup for Social Autopilot...')
  
  try {
    // Read the SQL file
    const sqlContent = fs.readFileSync('setup-auth-tables.sql', 'utf8')
    
    // Split into individual statements (split by semicolon, but handle multi-line statements)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`)
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.trim()) {
        try {
          console.log(`🔧 Executing statement ${i + 1}/${statements.length}...`)
          
          // Use the REST API to execute SQL
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: statement })
          })
          
          if (!response.ok) {
            const error = await response.text()
            console.log(`⚠️  Statement ${i + 1} failed (this might be expected): ${error}`)
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`)
          }
        } catch (error) {
          console.log(`⚠️  Statement ${i + 1} failed (this might be expected): ${error.message}`)
        }
      }
    }
    
    console.log('🎉 SQL setup completed!')
    
  } catch (error) {
    console.error('❌ SQL setup failed:', error.message)
  }
}

// Alternative: Use psql if available
async function runWithPsql() {
  console.log('🔧 Attempting to run with psql...')
  
  const connectionString = `postgresql://postgres:${supabaseServiceKey}@db.hdjjydmlsunzicnyvvyj.supabase.co:5432/postgres`
  
  try {
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)
    
    const sqlContent = fs.readFileSync('setup-auth-tables.sql', 'utf8')
    
    const { stdout, stderr } = await execAsync(`psql "${connectionString}" -c "${sqlContent}"`)
    
    if (stderr) {
      console.log('⚠️  Some warnings:', stderr)
    }
    
    console.log('✅ SQL executed successfully')
    console.log(stdout)
    
  } catch (error) {
    console.log('❌ psql not available or failed:', error.message)
    console.log('💡 Please run the SQL manually in your Supabase dashboard')
  }
}

// Try both methods
console.log('🔍 Checking if psql is available...')
runWithPsql().catch(() => {
  console.log('📝 Falling back to REST API method...')
  runSqlSetup()
})
