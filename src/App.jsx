import { useState, useEffect } from 'react'
import './App.css'
import InventoryApp from './components/Inventory'
import { Routes, Route, useNavigate  } from 'react-router-dom';

function App() {
  const [employees, setEmployees] = useState([])
  const [stats, setStats] = useState({})
  const [accessLevels, setAccessLevels] = useState([])
  const [activeTab, setActiveTab] = useState('employees')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAccessLevel, setSelectedAccessLevel] = useState('all')
  const [newEmployee, setNewEmployee] = useState({ 
    uid: '', 
    first_name: '', 
    last_name: '', 
    middle_name: '', 
    username: '', 
    access_level: '',
    password_salt: '',
    password_hash: '',
    tfa_salt: '',
    tfa_hash: ''
  })
  const [editingEmployee, setEditingEmployee] = useState(null)

  // Determine API base URL based on environment
  const API_BASE = window.location.hostname.includes('trycloudflare.com') 
    ? '/api'  // Use proxy when accessed via Cloudflare tunnel
    : 'http://localhost:3001/api'  // Direct connection for local development

  // Fetch data
  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${API_BASE}/employees`)
      const data = await response.json()
      setEmployees(data)
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  const fetchEmployeesByAccessLevel = async (level) => {
    try {
      const response = await fetch(`${API_BASE}/employees/access/${level}`)
      const data = await response.json()
      setEmployees(data)
    } catch (error) {
      console.error('Error fetching employees by access level:', error)
    }
  }

  const searchEmployees = async (query) => {
    try {
      if (query.trim()) {
        const response = await fetch(`${API_BASE}/employees/search/${encodeURIComponent(query)}`)
        const data = await response.json()
        setEmployees(data)
      } else {
        fetchEmployees()
      }
    } catch (error) {
      console.error('Error searching employees:', error)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/stats`)
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const fetchAccessLevels = async () => {
    try {
      const response = await fetch(`${API_BASE}/access-levels`)
      const data = await response.json()
      setAccessLevels(data)
    } catch (error) {
      console.error('Error fetching access levels:', error)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchEmployees(), fetchStats(), fetchAccessLevels()])
      setLoading(false)
    }
    loadData()
  }, [])

  // Handle search
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchQuery) {
        searchEmployees(searchQuery)
      } else if (selectedAccessLevel !== 'all') {
        fetchEmployeesByAccessLevel(selectedAccessLevel)
      } else {
        fetchEmployees()
      }
    }, 300)

    return () => clearTimeout(delayedSearch)
  }, [searchQuery])

  // Handle access level filter
  const handleAccessLevelFilter = (level) => {
    setSelectedAccessLevel(level)
    setSearchQuery('')
    if (level === 'all') {
      fetchEmployees()
    } else {
      fetchEmployeesByAccessLevel(level)
    }
  }

  // Create new employee
  const handleCreateEmployee = async (e) => {
    e.preventDefault()
    try {
      const response = await fetch(`${API_BASE}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newEmployee,
          uid: parseInt(newEmployee.uid) || 0
        })
      })
      if (response.ok) {
        setNewEmployee({ 
          uid: '', 
          first_name: '', 
          last_name: '', 
          middle_name: '', 
          username: '', 
          access_level: '',
          password_salt: '',
          password_hash: '',
          tfa_salt: '',
          tfa_hash: ''
        })
        fetchEmployees()
        fetchStats()
        fetchAccessLevels()
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Error creating employee:', error)
      alert('Error creating employee')
    }
  }

  // Update employee
  const handleUpdateEmployee = async (e) => {
    e.preventDefault()
    try {
      const response = await fetch(`${API_BASE}/employees/${editingEmployee.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingEmployee)
      })
      if (response.ok) {
        setEditingEmployee(null)
        fetchEmployees()
        fetchStats()
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Error updating employee:', error)
      alert('Error updating employee')
    }
  }

  // Delete employee
  const handleDeleteEmployee = async (uid) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      try {
        const response = await fetch(`${API_BASE}/employees/${uid}`, { method: 'DELETE' })
        if (response.ok) {
          fetchEmployees()
          fetchStats()
        } else {
          const errorData = await response.json()
          alert(`Error: ${errorData.error}`)
        }
      } catch (error) {
        console.error('Error deleting employee:', error)
        alert('Error deleting employee')
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading employee database...</p>
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-gray-900">Employee Management System</h1>
              <div className="ml-4 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                Connected
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Database: {stats.database_path}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold">👥</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Employees</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.total_employees}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {stats.access_levels && stats.access_levels.slice(0, 3).map((level, index) => (
            <div key={level.access_level} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className={`w-8 h-8 ${['bg-green-500', 'bg-purple-500', 'bg-orange-500'][index]} rounded-full flex items-center justify-center`}>
                    <span className="text-white font-semibold text-xs">{level.access_level?.charAt(0)?.toUpperCase()}</span>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">{level.access_level || 'Unassigned'}</dt>
                      <dd className="text-lg font-medium text-gray-900">{level.count}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="p-1">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search employees by name or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={selectedAccessLevel}
                onChange={(e) => handleAccessLevelFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Access Levels</option>
                {accessLevels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white shadow rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('employees')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'employees'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Employees ({employees.length})
              </button>
              <button
                onClick={() => setActiveTab('add')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'add'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Add Employee
              </button>
            </nav>
          </div>

          <div className="p-1">
            {activeTab === 'employees' && (
              <div>
                {/* Edit Employee Modal */}
                {editingEmployee && (
                  <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">Edit Employee</h3>
                      <form onSubmit={handleUpdateEmployee} className="space-y-4">
                        <input
                          type="text"
                          placeholder="First Name"
                          value={editingEmployee.first_name || ''}
                          onChange={(e) => setEditingEmployee({...editingEmployee, first_name: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Last Name"
                          value={editingEmployee.last_name || ''}
                          onChange={(e) => setEditingEmployee({...editingEmployee, last_name: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Middle Name"
                          value={editingEmployee.middle_name || ''}
                          onChange={(e) => setEditingEmployee({...editingEmployee, middle_name: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                        <input
                          type="text"
                          placeholder="Username"
                          value={editingEmployee.username || ''}
                          onChange={(e) => setEditingEmployee({...editingEmployee, username: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Access Level"
                          value={editingEmployee.access_level || ''}
                          onChange={(e) => setEditingEmployee({...editingEmployee, access_level: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                          >
                            Update
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingEmployee(null)}
                            className="flex-1 px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Employees Table */}
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">UID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Access Level</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Security</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {employees.map((employee) => (
                        <tr key={employee.uid}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{employee.uid}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {`${employee.last_name}, ${employee.first_name} ${employee.middle_name || ''}`}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{employee.username}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              {employee.access_level || 'Unassigned'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex space-x-2">
                              <span className={`inline-flex px-2 py-1 text-xs rounded ${employee.password_hash ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                PWD: {employee.password_hash ? '✓' : '✗'}
                              </span>
                              <span className={`inline-flex px-2 py-1 text-xs rounded ${employee.tfa_hash ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                2FA: {employee.tfa_hash ? '✓' : '✗'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => setEditingEmployee(employee)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteEmployee(employee.uid)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'add' && (
              <div>
                {/* Add Employee Form */}
                <form onSubmit={handleCreateEmployee} className="max-w-2xl">
                  <h3 className="text-lg font-medium mb-6">Add New Employee</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <input
                      type="number"
                      placeholder="Employee UID"
                      value={newEmployee.uid}
                      onChange={(e) => setNewEmployee({...newEmployee, uid: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                    <input
                      type="text"
                      placeholder="First Name"
                      value={newEmployee.first_name}
                      onChange={(e) => setNewEmployee({...newEmployee, first_name: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={newEmployee.last_name}
                      onChange={(e) => setNewEmployee({...newEmployee, last_name: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Middle Name"
                      value={newEmployee.middle_name}
                      onChange={(e) => setNewEmployee({...newEmployee, middle_name: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <input
                      type="text"
                      placeholder="Username"
                      value={newEmployee.username}
                      onChange={(e) => setNewEmployee({...newEmployee, username: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Access Level"
                      value={newEmployee.access_level}
                      onChange={(e) => setNewEmployee({...newEmployee, access_level: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  
                  <div className="mb-6">
                    <h4 className="text-md font-medium mb-3 text-gray-700">Security Information (Optional)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Password Salt"
                        value={newEmployee.password_salt}
                        onChange={(e) => setNewEmployee({...newEmployee, password_salt: e.target.value})}
                        className="px-3 py-2 border border-gray-300 rounded-md"
                      />
                      <input
                        type="text"
                        placeholder="Password Hash"
                        value={newEmployee.password_hash}
                        onChange={(e) => setNewEmployee({...newEmployee, password_hash: e.target.value})}
                        className="px-3 py-2 border border-gray-300 rounded-md"
                      />
                      <input
                        type="text"
                        placeholder="2FA Salt"
                        value={newEmployee.tfa_salt}
                        onChange={(e) => setNewEmployee({...newEmployee, tfa_salt: e.target.value})}
                        className="px-3 py-2 border border-gray-300 rounded-md"
                      />
                      <input
                        type="text"
                        placeholder="2FA Hash"
                        value={newEmployee.tfa_hash}
                        onChange={(e) => setNewEmployee({...newEmployee, tfa_hash: e.target.value})}
                        className="px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Add Employee
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>

    <InventoryApp/>
    </>
  )
}

export default App