import { useState, useEffect } from 'react'

function InventoryApp() {
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState({})
  const [filters, setFilters] = useState({})
  const [activeTab, setActiveTab] = useState('items')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedLocation, setSelectedLocation] = useState('all')
  const [selectedBrand, setSelectedBrand] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
  const [pagination, setPagination] = useState({})
  const [sortBy, setSortBy] = useState('item_no')
  const [sortOrder, setSortOrder] = useState('ASC')
  const [newItem, setNewItem] = useState({
    item_no: '',
    item_name: '',
    brand: '',
    item_type: '',
    location: '',
    unit_of_measure: '',
    in_qty: 0,
    out_qty: 0,
    min_stock: 0,
    price_per_unit: 0,
    last_po: '',
    supplier: ''
  })
  const [editingItem, setEditingItem] = useState(null)

  // Determine API base URL based on environment
  const API_BASE = window.location.hostname.includes('trycloudflare.com') 
    ? '/api'  // Use proxy when accessed via Cloudflare tunnel
    : 'http://localhost:3001/api'  // Direct connection for local development

  // Fetch functions
  const fetchItems = async (page = 1, filters = {}) => {
    try {
      setLoading(true)
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
        ...filters
      })

      if (searchQuery) queryParams.append('search', searchQuery)
      if (selectedStatus !== 'all') queryParams.append('status', selectedStatus)
      if (selectedLocation !== 'all') queryParams.append('location', selectedLocation)
      if (selectedBrand !== 'all') queryParams.append('brand', selectedBrand)

      const response = await fetch(`${API_BASE}/items?${queryParams}`)
      const data = await response.json()
      
      if (data.success) {
        setItems(data.data)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Error fetching items:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSummary = async () => {
    try {
      const response = await fetch(`${API_BASE}/items/summary`)
      const data = await response.json()
      if (data.success) {
        setSummary(data.data)
      }
    } catch (error) {
      console.error('Error fetching summary:', error)
    }
  }

  const fetchFilters = async () => {
    try {
      const response = await fetch(`${API_BASE}/items/filters`)
      const data = await response.json()
      if (data.success) {
        setFilters(data.data)
      }
    } catch (error) {
      console.error('Error fetching filters:', error)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchSummary(), fetchFilters()])
      await fetchItems(1)
    }
    loadData()
  }, [])

  // Handle search and filtering
  useEffect(() => {
    const delayedFetch = setTimeout(() => {
      setCurrentPage(1)
      fetchItems(1)
    }, 300)

    return () => clearTimeout(delayedFetch)
  }, [searchQuery, selectedStatus, selectedLocation, selectedBrand, sortBy, sortOrder])

  // Handle pagination
  const handlePageChange = (page) => {
    setCurrentPage(page)
    fetchItems(page)
  }

  // Handle sorting
  const handleSort = (column) => {
    const newOrder = sortBy === column && sortOrder === 'ASC' ? 'DESC' : 'ASC'
    setSortBy(column)
    setSortOrder(newOrder)
  }

  // Create new item
  const handleCreateItem = async (e) => {
    e.preventDefault()
    try {
      const response = await fetch(`${API_BASE}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newItem,
          item_no: parseInt(newItem.item_no) || 0,
          in_qty: parseInt(newItem.in_qty) || 0,
          out_qty: parseInt(newItem.out_qty) || 0,
          min_stock: parseInt(newItem.min_stock) || 0,
          price_per_unit: parseFloat(newItem.price_per_unit) || 0
        })
      })
      
      if (response.ok) {
        setNewItem({
          item_no: '',
          item_name: '',
          brand: '',
          item_type: '',
          location: '',
          unit_of_measure: '',
          in_qty: 0,
          out_qty: 0,
          min_stock: 0,
          price_per_unit: 0,
          last_po: '',
          supplier: ''
        })
        fetchItems(currentPage)
        fetchSummary()
        setActiveTab('items')
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Error creating item:', error)
      alert('Error creating item')
    }
  }

  // Update item
  const handleUpdateItem = async (e) => {
    e.preventDefault()
    try {
      const response = await fetch(`${API_BASE}/items/${editingItem.item_no}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingItem)
      })
      
      if (response.ok) {
        setEditingItem(null)
        fetchItems(currentPage)
        fetchSummary()
      } else {
        const errorData = await response.json()
        alert(`Error: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Error updating item:', error)
      alert('Error updating item')
    }
  }

  // Delete item
  const handleDeleteItem = async (itemNo) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        const response = await fetch(`${API_BASE}/items/${itemNo}`, { method: 'DELETE' })
        if (response.ok) {
          fetchItems(currentPage)
          fetchSummary()
        } else {
          const errorData = await response.json()
          alert(`Error: ${errorData.error}`)
        }
      } catch (error) {
        console.error('Error deleting item:', error)
        alert('Error deleting item')
      }
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'In Stock': return 'bg-green-100 text-green-800'
      case 'Low In Stock': return 'bg-yellow-100 text-yellow-800'
      case 'Out Of Stock': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading && items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading inventory database...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className=" mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-gray-900">Inventory Management System</h1>
              <div className="ml-4 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                Connected
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto py-6 sm:px-6 lg:px-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white overflow-auto shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold">📦</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Items</dt>
                    <dd className="text-lg font-medium text-gray-900">{summary.total_items || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold">✓</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">In Stock</dt>
                    <dd className="text-lg font-medium text-gray-900">{summary.stock_status?.in_stock || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold">⚠</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Low Stock</dt>
                    <dd className="text-lg font-medium text-gray-900">{summary.stock_status?.low_stock || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold">✗</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Out of Stock</dt>
                    <dd className="text-lg font-medium text-gray-900">{summary.stock_status?.out_of_stock || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold">$</span>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Value</dt>
                    <dd className="text-lg font-medium text-gray-900">${summary.total_value || '0.00'}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search items by name, brand, or supplier..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="In Stock">In Stock</option>
                <option value="Low In Stock">Low In Stock</option>
                <option value="Out Of Stock">Out Of Stock</option>
              </select>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Locations</option>
                {filters.locations?.map(location => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Brands</option>
                {filters.brands?.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
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
                onClick={() => setActiveTab('items')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'items'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Items ({pagination.total_items || items.length})
              </button>
              <button
                onClick={() => setActiveTab('add')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'add'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Add Item
              </button>
              <button
                onClick={() => setActiveTab('lowstock')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'lowstock'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Low Stock Alert
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'items' && (
              <div>
                {/* Edit Item Modal */}
                {editingItem && (
                  <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">Edit Item</h3>
                      <form onSubmit={handleUpdateItem} className="grid grid-cols-2 gap-4">
                        <input
                          type="text"
                          placeholder="Item Name"
                          value={editingItem.item_name || ''}
                          onChange={(e) => setEditingItem({...editingItem, item_name: e.target.value})}
                          className="px-3 py-2 border border-gray-300 rounded-md"
                          required
                        />
                        <input
                          type="text"
                          placeholder="Brand"
                          value={editingItem.brand || ''}
                          onChange={(e) => setEditingItem({...editingItem, brand: e.target.value})}
                          className="px-3 py-2 border border-gray-300 rounded-md"
                        />
                        <input
                          type="text"
                          placeholder="Location"
                          value={editingItem.location || ''}
                          onChange={(e) => setEditingItem({...editingItem, location: e.target.value})}
                          className="px-3 py-2 border border-gray-300 rounded-md"
                        />
                        <input
                          type="number"
                          placeholder="Min Stock"
                          value={editingItem.min_stock || ''}
                          onChange={(e) => setEditingItem({...editingItem, min_stock: parseInt(e.target.value) || 0})}
                          className="px-3 py-2 border border-gray-300 rounded-md"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Price per Unit"
                          value={editingItem.price_per_unit || ''}
                          onChange={(e) => setEditingItem({...editingItem, price_per_unit: parseFloat(e.target.value) || 0})}
                          className="px-3 py-2 border border-gray-300 rounded-md"
                        />
                        <input
                          type="text"
                          placeholder="Supplier"
                          value={editingItem.supplier || ''}
                          onChange={(e) => setEditingItem({...editingItem, supplier: e.target.value})}
                          className="px-3 py-2 border border-gray-300 rounded-md"
                        />
                        <div className="col-span-2 flex gap-2 mt-4">
                          <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                          >
                            Update
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingItem(null)}
                            className="flex-1 px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Items Table */}
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('item_no')}
                        >
                          Item No {sortBy === 'item_no' && (sortOrder === 'ASC' ? '↑' : '↓')}
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('item_name')}
                        >
                          Item Name {sortBy === 'item_name' && (sortOrder === 'ASC' ? '↑' : '↓')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand/Location</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('cost')}
                        >
                          Value {sortBy === 'cost' && (sortOrder === 'ASC' ? '↑' : '↓')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {items.map((item) => (
                        <tr key={item.item_no}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.item_no}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            <div>
                              <div className="font-semibold">{item.item_name}</div>
                              <div className="text-xs text-gray-500">{item.item_type}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div>
                              <div>{item.brand}</div>
                              <div className="text-xs">{item.location}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div>
                              <div className="font-semibold">Balance: {item.balance}</div>
                              <div className="text-xs text-gray-500">
                                In: {item.in_qty} | Out: {item.out_qty} | Min: {item.min_stock}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div>
                              <div className="font-semibold">${item.cost}</div>
                              <div className="text-xs text-gray-500">@${item.price_per_unit}/{item.unit_of_measure}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.item_status)}`}>
                              {item.item_status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => setEditingItem(item)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.item_no)}
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

                {/* Pagination */}
                {pagination.total_pages > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
                    <div className="flex flex-1 justify-between sm:hidden">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={!pagination.has_prev}
                        className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={!pagination.has_next}
                        className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Showing page {pagination.current_page} of {pagination.total_pages} ({pagination.total_items} total items)
                        </p>
                      </div>
                      <div>
                        <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                          {Array.from({ length: Math.min(pagination.total_pages, 10) }, (_, i) => i + 1).map((page) => (
                            <button
                              key={page}
                              onClick={() => handlePageChange(page)}
                              className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                                currentPage === page
                                  ? 'z-10 bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                                  : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                              }`}
                            >
                              {page}
                            </button>
                          ))}
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'add' && (
              <div>
                <form onSubmit={handleCreateItem} className="max-w-4xl">
                  <h3 className="text-lg font-medium mb-6">Add New Inventory Item</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <input
                      type="number"
                      placeholder="Item Number"
                      value={newItem.item_no}
                      onChange={(e) => setNewItem({...newItem, item_no: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Item Name"
                      value={newItem.item_name}
                      onChange={(e) => setNewItem({...newItem, item_name: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Brand"
                      value={newItem.brand}
                      onChange={(e) => setNewItem({...newItem, brand: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <input
                      type="text"
                      placeholder="Item Type"
                      value={newItem.item_type}
                      onChange={(e) => setNewItem({...newItem, item_type: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <input
                      type="text"
                      placeholder="Location"
                      value={newItem.location}
                      onChange={(e) => setNewItem({...newItem, location: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <input
                      type="text"
                      placeholder="Unit of Measure"
                      value={newItem.unit_of_measure}
                      onChange={(e) => setNewItem({...newItem, unit_of_measure: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <input
                      type="number"
                      placeholder="In Quantity"
                      value={newItem.in_qty}
                      onChange={(e) => setNewItem({...newItem, in_qty: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <input
                      type="number"
                      placeholder="Out Quantity"
                      value={newItem.out_qty}
                      onChange={(e) => setNewItem({...newItem, out_qty: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <input
                      type="number"
                      placeholder="Minimum Stock"
                      value={newItem.min_stock}
                      onChange={(e) => setNewItem({...newItem, min_stock: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Price per Unit"
                      value={newItem.price_per_unit}
                      onChange={(e) => setNewItem({...newItem, price_per_unit: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <input
                      type="date"
                      placeholder="Last PO Date"
                      value={newItem.last_po}
                      onChange={(e) => setNewItem({...newItem, last_po: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <input
                      type="text"
                      placeholder="Supplier"
                      value={newItem.supplier}
                      onChange={(e) => setNewItem({...newItem, supplier: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Add Item
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'lowstock' && (
              <div>
                <h3 className="text-lg font-medium mb-6">Low Stock Alert</h3>
                <LowStockTable apiBase={API_BASE} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

// Low Stock Component
function LowStockTable({ apiBase }) {
  const [lowStockItems, setLowStockItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLowStock = async () => {
      try {
        const response = await fetch(`${apiBase}/items/low-stock`)
        const data = await response.json()
        if (data.success) {
          setLowStockItems(data.data)
        }
      } catch (error) {
        console.error('Error fetching low stock items:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLowStock()
  }, [apiBase])

  if (loading) {
    return <div className="text-center py-4">Loading low stock items...</div>
  }

  if (lowStockItems.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-green-600 text-lg font-semibold">🎉 All items are well stocked!</div>
        <p className="text-gray-500 mt-2">No items currently require restocking.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-red-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min Stock</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deficit</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last PO</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {lowStockItems.map((item) => (
            <tr key={item.item_no} className="hover:bg-red-25">
              <td className="px-6 py-4 whitespace-nowrap">
                <div>
                  <div className="text-sm font-medium text-gray-900">{item.item_name}</div>
                  <div className="text-sm text-gray-500">{item.brand} - {item.location}</div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <span className={`font-semibold ${item.balance <= 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                  {item.balance}
                </span>
                <span className="text-gray-500 ml-1">{item.unit_of_measure}</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.min_stock}</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                  -{item.deficit}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.supplier || 'N/A'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {item.last_po ? new Date(item.last_po).toLocaleDateString() : 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="bg-red-50 px-6 py-3">
        <div className="text-sm text-red-700">
          <strong>Alert:</strong> {lowStockItems.length} item(s) require immediate attention for restocking.
        </div>
      </div>
    </div>
  )
}

export default InventoryApp