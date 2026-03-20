import React, { useState, useRef, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { 
  Package, 
  ListChecks, 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  Search,
  Edit,
  Upload,
  Download
} from 'lucide-react';

// ==========================================
// 🔴 จุดสำคัญ: ใส่ Config Firebase ของคุณที่นี่
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDdJTmCGUoqBIKi3BM2UJuzgWT-7GlGu5Y",
  authDomain: "zp-purchase.firebaseapp.com",
  projectId: "zp-purchase",
  storageBucket: "zp-purchase.firebasestorage.app",
  messagingSenderId: "75480023563",
  appId: "1:75480023563:web:2f523f34fdf67ea697fd0e",
  measurementId: "G-FQ7D2WN0CZ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [activeTab, setActiveTab] = useState('orders');
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);

  // State สำหรับแท็บรายการสั่งซื้อ
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const initialOrderState = { 
    poNumber: '', supplier: '', purchaseDate: new Date().toISOString().split('T')[0], 
    orderNumber: '', tracking: '', paidAmount: '',
    items: [{ productSku: '', productName: '', unitPrice: '', qty: 1, status: 'ระหว่างขนส่ง' }] 
  };
  const [newOrder, setNewOrder] = useState(initialOrderState);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State สำหรับแท็บใบตรวจนับสินค้า (Packing List)
  const [trackingInput, setTrackingInput] = useState('');
  const [packingList, setPackingList] = useState<string[]>([]);

  // ==========================================
  // Authentication & Data Fetching
  // ==========================================
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const ordersRef = collection(db, 'artifacts', appId, 'users', user.uid, 'orders');
    const unsubscribe = onSnapshot(ordersRef, (snapshot) => {
      const fetchedOrders: any[] = [];
      snapshot.forEach((doc) => {
        fetchedOrders.push({ ...doc.data(), id: Number(doc.id) });
      });
      fetchedOrders.sort((a, b) => b.id - a.id);
      setOrders(fetchedOrders);
    }, (error) => {
      console.error("Error fetching data:", error);
    });
    
    return () => unsubscribe();
  }, [user]);

  // ==========================================
  // ฟังก์ชันส่วนของรายการสั่งซื้อ (Orders)
  // ==========================================
  const filteredOrders = orders.filter(order => {
    const searchLower = searchTerm.toLowerCase();
    const matchPo = order.poNumber?.toLowerCase().includes(searchLower);
    const matchOrderNo = order.orderNumber?.toLowerCase().includes(searchLower);
    const matchTracking = order.tracking?.toLowerCase().includes(searchLower);
    const matchSku = order.items?.some((item: any) => item.productSku?.toLowerCase().includes(searchLower));
    return matchPo || matchOrderNo || matchTracking || matchSku;
  });

  const handleSelectOrder = (id: number) => {
    if (selectedOrders.includes(id)) {
      setSelectedOrders(selectedOrders.filter(orderId => orderId !== id));
    } else {
      setSelectedOrders([...selectedOrders, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id));
    }
  };

  const handleAddItem = (isEdit: boolean) => {
    const newItem = { productSku: '', productName: '', unitPrice: '', qty: 1, status: 'ระหว่างขนส่ง' };
    if (isEdit) {
      setEditingOrder({...editingOrder, items: [...(editingOrder.items || []), newItem]});
    } else {
      setNewOrder({...newOrder, items: [...(newOrder.items || []), newItem]});
    }
  };

  const handleRemoveItem = (index: number, isEdit: boolean) => {
    if (isEdit) {
      setEditingOrder({...editingOrder, items: editingOrder.items.filter((_: any, i: number) => i !== index)});
    } else {
      setNewOrder({...newOrder, items: newOrder.items.filter((_: any, i: number) => i !== index)});
    }
  };

  const handleItemChange = (index: number, field: string, value: string | number, isEdit: boolean) => {
    if (isEdit) {
      const updatedItems = [...editingOrder.items];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      setEditingOrder({...editingOrder, items: updatedItems});
    } else {
      const updatedItems = [...newOrder.items];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      setNewOrder({...newOrder, items: updatedItems});
    }
  };

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { alert('รอเชื่อมต่อฐานข้อมูลสักครู่'); return; }
    
    const newId = orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 1;
    const orderData = { id: newId, ...newOrder };
    
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'orders', newId.toString()), orderData);
      setShowAddModal(false);
      setNewOrder(initialOrderState);
    } catch (error) {
      console.error("Error saving data:", error);
    }
  };

  const handleDeleteOrder = async (id: number) => {
    if (!user) return;
    if (window.confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'orders', id.toString()));
        setSelectedOrders(selectedOrders.filter(orderId => orderId !== id));
      } catch (error) {
        console.error("Error deleting data:", error);
      }
    }
  };

  const handleEditClick = (order: any) => {
    const orderToEdit = { ...order };
    if (orderToEdit.paidAmount === undefined) {
      if (orderToEdit.items && orderToEdit.items.length > 0 && orderToEdit.items[0].paidAmount !== undefined) {
        orderToEdit.paidAmount = orderToEdit.items.reduce((sum: number, item: any) => sum + (Number(item.paidAmount) || 0), 0);
      } else {
        orderToEdit.paidAmount = order.paidAmount || '';
      }
    }
    if (!orderToEdit.items) {
      orderToEdit.items = [{ productSku: order.productSku || '', productName: order.productName || '', unitPrice: order.unitPrice || 0, qty: order.qty || 1, status: 'ระหว่างขนส่ง' }];
    } else {
      orderToEdit.items = orderToEdit.items.map((item: any) => ({ ...item, status: item.status || 'รับสินค้าแล้ว' }));
    }
    setEditingOrder(orderToEdit);
    setShowEditModal(true);
  };

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'orders', editingOrder.id.toString()), editingOrder);
      setShowEditModal(false);
      setEditingOrder(null);
    } catch (error) {
      console.error("Error updating data:", error);
    }
  };

  const downloadTemplate = () => {
    const headers = ['PO Number', 'Supplier', 'Purchase Date', 'Order Number', 'Tracking Number', 'Product SKU', 'Product Name', 'Unit Price', 'Quantity', 'Status', 'Paid Amount'];
    generateCSV([headers], 'import_template.csv');
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const cleanText = text.replace(/^\uFEFF/, '');
      const rows = cleanText.split('\n').filter(row => row.trim() !== '');
      
      if (rows.length <= 1) { alert('ไม่พบข้อมูลในไฟล์ CSV'); return; }
      
      const orderMap = new Map();
      let currentMaxId = orders.length > 0 ? Math.max(...orders.map(o => o.id)) : 0;

      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length >= 10) {
          const poNumber = cols[0] || '';
          const tracking = cols[4] || '';
          const groupKey = poNumber + '_' + tracking;
          
          let statusText = 'รับสินค้าแล้ว';
          let paidAmt = 0;
          if (cols.length >= 11) {
            statusText = cols[9] || 'รับสินค้าแล้ว';
            paidAmt = Number(cols[10]) || 0;
          } else {
            paidAmt = Number(cols[9]) || 0;
          }
          
          if (!orderMap.has(groupKey)) {
            currentMaxId++;
            orderMap.set(groupKey, {
              id: currentMaxId, poNumber, supplier: cols[1] || '',
              purchaseDate: cols[2] || new Date().toISOString().split('T')[0],
              orderNumber: cols[3] || '', tracking, paidAmount: paidAmt, items: []
            });
          }
          
          orderMap.get(groupKey).items.push({
            productSku: cols[5] || '', productName: cols[6] || '',
            unitPrice: Number(cols[7]) || 0, qty: Number(cols[8]) || 1, status: statusText
          });
        }
      }
      
      const newOrdersList = Array.from(orderMap.values());
      if (newOrdersList.length > 0 && user) {
        newOrdersList.forEach(async (order) => {
          try { await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'orders', order.id.toString()), order); } 
          catch (error) { console.error("Error importing data:", error); }
        });
        alert(`เริ่มนำเข้าข้อมูลจัดกลุ่มได้ ${newOrdersList.length} รายการสั่งซื้อ`);
      } else if (!user) { alert('กรุณารอการเชื่อมต่อฐานข้อมูลสักครู่'); } 
      else { alert('ไม่สามารถอ่านข้อมูลได้ กรุณาตรวจสอบไฟล์'); }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = ''; 
  };

  const exportOrdersToCSV = () => {
    if (selectedOrders.length === 0) { alert('กรุณาเลือกรายการที่ต้องการ Export อย่างน้อย 1 รายการ'); return; }

    const dataToExport = orders.filter(o => selectedOrders.includes(o.id));
    const headers = ['PO Number', 'Supplier', 'Purchase Date', 'Order Number', 'Tracking Number', 'Product SKU', 'Product Name', 'Unit Price', 'Quantity', 'Status', 'Paid Amount'];
    
    const csvData: any[] = [];
    dataToExport.forEach(order => {
      if (order.items && order.items.length > 0) {
        order.items.forEach((item: any) => {
          csvData.push([order.poNumber, order.supplier, order.purchaseDate, order.orderNumber, order.tracking, item.productSku, item.productName, item.unitPrice, item.qty, item.status || 'รับสินค้าแล้ว', order.paidAmount]);
        });
      } else {
        csvData.push([order.poNumber, order.supplier, order.purchaseDate, order.orderNumber, order.tracking, '', '', 0, 0, 'รับสินค้าแล้ว', order.paidAmount || 0]);
      }
    });

    generateCSV([headers, ...csvData], 'orders_export.csv');
  };

  const handleAddTracking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingInput.trim()) return;
    const trackings = trackingInput.split(/[\n,]/).map(t => t.trim()).filter(t => t !== '');
    const newTrackings = trackings.filter(t => !packingList.includes(t));
    if (newTrackings.length > 0) setPackingList([...packingList, ...newTrackings]);
    setTrackingInput('');
  };

  const handleRemoveTracking = (trackingToRemove: string) => {
    setPackingList(packingList.filter(t => t !== trackingToRemove));
  };

  const exportPackingListToCSV = () => {
    if (packingList.length === 0) { alert('ไม่มีรายการ Tracking สำหรับ Export'); return; }

    const headers = ['ลำดับ', 'Tracking Number', 'Order Number', 'Supplier', 'Product SKU', 'Product Name', 'Quantity'];
    const csvData: any[] = [];
    packingList.forEach((tracking, index) => {
      const matchedOrder = orders.find(o => o.tracking === tracking);
      if (matchedOrder && matchedOrder.items && matchedOrder.items.length > 0) {
        matchedOrder.items.forEach((item: any) => {
          csvData.push([index + 1, tracking, matchedOrder.orderNumber, matchedOrder.supplier, item.productSku, item.productName, item.qty]);
        });
      } else {
        csvData.push([index + 1, tracking, matchedOrder ? matchedOrder.orderNumber : 'ไม่พบข้อมูลในระบบ', matchedOrder ? matchedOrder.supplier : '-', '-', '-', '-']);
      }
    });

    generateCSV([headers, ...csvData], 'packing_list.csv');
  };

  const generateCSV = (dataArray: any[], filename: string) => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + dataArray.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Package className="h-8 w-8 text-blue-600 mr-2" />
                <span className="font-bold text-xl text-gray-900">ZP Purchase App</span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`${activeTab === 'orders' ? 'border-blue-500 text-gray-900' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  <ListChecks className="w-4 h-4 mr-2" />
                  บันทึกรายการสั่งซื้อ
                </button>
                <button
                  onClick={() => setActiveTab('packing')}
                  className={`${activeTab === 'packing' ? 'border-blue-500 text-gray-900' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  <Package className="w-4 h-4 mr-2" />
                  สร้างใบตรวจนับสินค้า (Packing List)
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        
        {activeTab === 'orders' && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                รายการสั่งซื้อสินค้า
              </h3>
              <div className="flex flex-wrap gap-3 justify-end items-center">
                
                <div className="flex items-center bg-white border border-gray-300 rounded-md px-3 py-1.5 shadow-sm focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500">
                  <Search className="w-4 h-4 text-gray-400 mr-2" />
                  <input
                    type="text"
                    placeholder="ค้นหา PO, Order No, SKU, Tracking..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border-none focus:ring-0 text-sm w-full sm:w-64 p-0 outline-none"
                  />
                </div>

                <button onClick={downloadTemplate} className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                  <Download className="w-4 h-4 mr-2" /> โหลด Template
                </button>
                
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleImportCSV} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                  <Upload className="w-4 h-4 mr-2" /> นำเข้า (CSV)
                </button>

                <button onClick={() => setShowAddModal(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" /> เพิ่มใบสั่งซื้อ
                </button>
                <button
                  onClick={exportOrdersToCSV}
                  disabled={selectedOrders.length === 0}
                  className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm ${selectedOrders.length > 0 ? 'border-green-600 text-green-600 bg-white hover:bg-green-50' : 'border-gray-300 text-gray-400 bg-gray-50 cursor-not-allowed'}`}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> 
                  Export ไป Google Sheet ({selectedOrders.length})
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input type="checkbox" className="h-4 w-4 text-blue-600 rounded border-gray-300" checked={filteredOrders.length > 0 && selectedOrders.length === filteredOrders.length} onChange={handleSelectAll} />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO / Order No.</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Info</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สถานะ</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tracking Number</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders.length === 0 ? (
                    <tr><td colSpan={9} className="px-6 py-4 text-center text-sm text-gray-500">{searchTerm ? 'ไม่พบข้อมูลที่ค้นหา' : 'ไม่มีข้อมูลรายการสั่งซื้อ'}</td></tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.id} className={`align-top ${selectedOrders.includes(order.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input type="checkbox" className="h-4 w-4 text-blue-600 rounded border-gray-300" checked={selectedOrders.includes(order.id)} onChange={() => handleSelectOrder(order.id)} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.purchaseDate}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="font-bold text-gray-900">{order.poNumber}</div>
                          <div className="text-xs text-gray-500">{order.orderNumber}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.supplier}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 min-w-[250px]">
                          {order.items && order.items.map((item: any, idx: number) => (
                            <div key={idx} className="mb-2 pb-2 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0">
                              <div className="font-medium text-gray-900">{item.productName}</div>
                              <div className="text-xs text-gray-500">SKU: {item.productSku} | Qty: <span className="font-semibold text-gray-700">{item.qty}</span></div>
                            </div>
                          ))}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 min-w-[140px]">
                          {order.items && order.items.map((item: any, idx: number) => (
                            <div key={idx} className="mb-2 pb-2 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0 flex items-center h-full min-h-[40px]">
                              <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full ${item.status === 'สินค้ามีปัญหา' ? 'bg-red-100 text-red-800' : item.status === 'แจ้งเคลมแล้ว' ? 'bg-yellow-100 text-yellow-800' : item.status === 'ระหว่างขนส่ง' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                                {item.status || 'รับสินค้าแล้ว'}
                              </span>
                            </div>
                          ))}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {order.tracking || 'รอดำเนินการ'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                          {order.items && order.items.map((item: any, idx: number) => (
                            <div key={idx} className="mb-2 pb-2 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0">
                              <div className="font-medium text-gray-900">{(Number(item.unitPrice) * Number(item.qty)).toLocaleString()}</div>
                              <div className="text-xs text-gray-400">@ {Number(item.unitPrice).toLocaleString()}</div>
                            </div>
                          ))}
                          <div className="mt-2 pt-2 border-t border-gray-200 font-bold text-blue-600 flex justify-between gap-4">
                            <span>ยอดจ่ายจริง:</span>
                            <span>{Number(order.paidAmount || 0).toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <div className="flex justify-center space-x-2">
                            <button onClick={() => handleEditClick(order)} className="text-blue-600 hover:text-blue-900 bg-blue-50 p-2 rounded-full"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteOrder(order.id)} className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-full"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================= แท็บ: สร้างใบตรวจนับสินค้า ======================= */}
        {activeTab === 'packing' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Search className="w-5 h-5 mr-2 text-gray-400" />
                  สแกน / กรอก Tracking
                </h3>
                <form onSubmit={handleAddTracking}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tracking Number</label>
                    <textarea rows={4} className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border" placeholder="วาง Tracking Number ที่นี่" value={trackingInput} onChange={(e) => setTrackingInput(e.target.value)} />
                  </div>
                  <button type="submit" className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">เพิ่มเข้า Packing List</button>
                </form>
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900">รายการตรวจนับ (Packing List)</h3>
                    <p className="mt-1 text-sm text-gray-500">จำนวนทั้งหมด {packingList.length} กล่อง (Tracking)</p>
                  </div>
                  <button onClick={exportPackingListToCSV} disabled={packingList.length === 0} className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm ${packingList.length > 0 ? 'border-green-600 text-white bg-green-600 hover:bg-green-700' : 'border-gray-300 text-gray-400 bg-gray-50 cursor-not-allowed'}`}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" /> Export ไป Google Sheet
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">ลำดับ</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">Tracking Number</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ข้อมูลสินค้าภายในกล่อง</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {packingList.length === 0 ? (
                        <tr><td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500">ยังไม่มีรายการใน Packing List<br/><span className="text-xs">กรุณากรอก Tracking Number ทางด้านซ้าย</span></td></tr>
                      ) : (
                        packingList.map((tracking, index) => {
                          const matchedOrder = orders.find(o => o.tracking === tracking);
                          return (
                            <tr key={index} className="hover:bg-gray-50 align-top">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{tracking}</td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {matchedOrder ? (
                                  <div>
                                    <div className="mb-2 pb-2 border-b border-dashed border-gray-200 flex space-x-4">
                                      <span className="font-semibold text-blue-600">PO: {matchedOrder.poNumber}</span>
                                      <span className="text-gray-500">Order: {matchedOrder.orderNumber}</span>
                                    </div>
                                    <ul className="space-y-2">
                                      {matchedOrder.items && matchedOrder.items.map((item: any, idx: number) => (
                                        <li key={idx} className="flex items-start justify-between">
                                          <div>
                                            <span className="text-gray-900 font-medium">{item.productName}</span>
                                            <span className="text-xs text-gray-500 ml-2">(SKU: {item.productSku})</span>
                                          </div>
                                          <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded ml-4 whitespace-nowrap">x {item.qty}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : (
                                  <span className="text-red-500 text-xs flex items-center bg-red-50 p-2 rounded w-max">ไม่พบข้อมูล Tracking ในระบบ</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button onClick={() => handleRemoveTracking(tracking)} className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-full"><Trash2 className="w-4 h-4" /></button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

{/* Modal เพิ่มข้อมูล */}
{showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-gray-800/75 transition-opacity">
          <div className="relative w-full max-w-4xl max-h-[95vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden">
            
            {/* Header (ส่วนหัว Fixed ไม่เลื่อนตาม) */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white shrink-0">
              <h3 className="text-xl font-bold text-gray-900">สร้างใบสั่งซื้อใหม่</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleAddOrder} className="flex flex-col flex-1 overflow-hidden">
              {/* Body (ส่วนเนื้อหาตรงกลางที่ Scroll เลื่อนขึ้นลงได้) */}
              <div className="px-6 py-6 overflow-y-auto flex-1 bg-gray-50/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  <div><label className="block text-xs font-semibold text-gray-700 uppercase">PO Number</label><input type="text" required value={newOrder.poNumber} onChange={e => setNewOrder({...newOrder, poNumber: e.target.value})} className="mt-1 block w-full border-gray-300 border p-2 rounded-md bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                  <div><label className="block text-xs font-semibold text-gray-700 uppercase">Purchase Date</label><input type="date" required value={newOrder.purchaseDate} onChange={e => setNewOrder({...newOrder, purchaseDate: e.target.value})} className="mt-1 block w-full border-gray-300 border p-2 rounded-md bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                  <div><label className="block text-xs font-semibold text-gray-700 uppercase">Order Number</label><input type="text" required value={newOrder.orderNumber} onChange={e => setNewOrder({...newOrder, orderNumber: e.target.value})} className="mt-1 block w-full border-gray-300 border p-2 rounded-md bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                  <div><label className="block text-xs font-semibold text-gray-700 uppercase">Supplier</label><input type="text" required value={newOrder.supplier} onChange={e => setNewOrder({...newOrder, supplier: e.target.value})} className="mt-1 block w-full border-gray-300 border p-2 rounded-md bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                  <div><label className="block text-xs font-semibold text-gray-700 uppercase">Tracking Number</label><input type="text" required value={newOrder.tracking} onChange={e => setNewOrder({...newOrder, tracking: e.target.value})} className="mt-1 block w-full border-gray-300 border p-2 rounded-md bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                  <div><label className="block text-xs font-semibold text-gray-700 uppercase">Paid Amount (ยอดจ่ายจริง)</label><input type="number" min="0" required value={newOrder.paidAmount} onChange={e => setNewOrder({...newOrder, paidAmount: e.target.value})} className="mt-1 block w-full border-gray-300 border p-2 rounded-md bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-gray-800 text-lg">รายการสินค้า (Items)</h4>
                    <button type="button" onClick={() => handleAddItem(false)} className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 shadow-sm"><Plus className="w-4 h-4 mr-1" /> เพิ่มสินค้า</button>
                  </div>
                  {newOrder.items.map((item, index) => (
                    <div key={index} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4 relative">
                      {newOrder.items.length > 1 && <button type="button" onClick={() => handleRemoveItem(index, false)} className="absolute top-3 right-3 text-red-400 hover:text-red-600 bg-red-50 p-1.5 rounded-full"><Trash2 className="w-4 h-4" /></button>}
                      <div className="grid grid-cols-12 gap-3 pr-8">
                        <div className="col-span-12 sm:col-span-2"><label className="block text-xs text-gray-500 mb-1">SKU</label><input type="text" required value={item.productSku} onChange={e => handleItemChange(index, 'productSku', e.target.value, false)} className="block w-full border border-gray-300 p-2 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                        <div className="col-span-12 sm:col-span-3"><label className="block text-xs text-gray-500 mb-1">Product Name</label><input type="text" required value={item.productName} onChange={e => handleItemChange(index, 'productName', e.target.value, false)} className="block w-full border border-gray-300 p-2 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                        <div className="col-span-4 sm:col-span-2"><label className="block text-xs text-gray-500 mb-1">Unit Price</label><input type="number" min="0" required value={item.unitPrice} onChange={e => handleItemChange(index, 'unitPrice', e.target.value, false)} className="block w-full border border-gray-300 p-2 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                        <div className="col-span-4 sm:col-span-2"><label className="block text-xs text-gray-500 mb-1">Qty</label><input type="number" min="1" required value={item.qty} onChange={e => handleItemChange(index, 'qty', e.target.value, false)} className="block w-full border border-gray-300 p-2 rounded text-center font-bold shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                        <div className="col-span-4 sm:col-span-3"><label className="block text-xs text-gray-500 mb-1">สถานะ</label><select value={item.status || 'ระหว่างขนส่ง'} onChange={e => handleItemChange(index, 'status', e.target.value, false)} className="block w-full border border-gray-300 p-2 rounded bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500"><option value="ระหว่างขนส่ง">ระหว่างขนส่ง</option><option value="รับสินค้าแล้ว">รับสินค้าแล้ว</option><option value="สินค้ามีปัญหา">สินค้ามีปัญหา</option><option value="แจ้งเคลมแล้ว">แจ้งเคลมแล้ว</option></select></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer (ส่วนปุ่ม Fixed ติดขอบล่างเสมอ) */}
              <div className="px-6 py-4 border-t border-gray-200 bg-white flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 sm:space-x-reverse shrink-0">
                <button type="button" onClick={() => setShowAddModal(false)} className="mt-3 sm:mt-0 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-6 py-2.5 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:w-auto">ยกเลิก</button>
                <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-6 py-2.5 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 sm:w-auto">บันทึกข้อมูลใบสั่งซื้อ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal แก้ไขข้อมูล (ใช้โครงสร้างแบบเดียวกัน) */}
      {showEditModal && editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-gray-800/75 transition-opacity">
          <div className="relative w-full max-w-4xl max-h-[95vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white shrink-0">
              <h3 className="text-xl font-bold text-gray-900">แก้ไขใบสั่งซื้อ</h3>
              <button type="button" onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleUpdateOrder} className="flex flex-col flex-1 overflow-hidden">
              {/* Body */}
              <div className="px-6 py-6 overflow-y-auto flex-1 bg-gray-50/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  <div><label className="block text-xs font-semibold text-gray-700 uppercase">PO Number</label><input type="text" required value={editingOrder.poNumber} onChange={e => setEditingOrder({...editingOrder, poNumber: e.target.value})} className="mt-1 block w-full border-gray-300 border p-2 rounded-md bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                  <div><label className="block text-xs font-semibold text-gray-700 uppercase">Purchase Date</label><input type="date" required value={editingOrder.purchaseDate} onChange={e => setEditingOrder({...editingOrder, purchaseDate: e.target.value})} className="mt-1 block w-full border-gray-300 border p-2 rounded-md bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                  <div><label className="block text-xs font-semibold text-gray-700 uppercase">Order Number</label><input type="text" required value={editingOrder.orderNumber} onChange={e => setEditingOrder({...editingOrder, orderNumber: e.target.value})} className="mt-1 block w-full border-gray-300 border p-2 rounded-md bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                  <div><label className="block text-xs font-semibold text-gray-700 uppercase">Supplier</label><input type="text" required value={editingOrder.supplier} onChange={e => setEditingOrder({...editingOrder, supplier: e.target.value})} className="mt-1 block w-full border-gray-300 border p-2 rounded-md bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                  <div><label className="block text-xs font-semibold text-gray-700 uppercase">Tracking Number</label><input type="text" required value={editingOrder.tracking} onChange={e => setEditingOrder({...editingOrder, tracking: e.target.value})} className="mt-1 block w-full border-gray-300 border p-2 rounded-md bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                  <div><label className="block text-xs font-semibold text-gray-700 uppercase">Paid Amount (ยอดจ่ายจริง)</label><input type="number" min="0" required value={editingOrder.paidAmount} onChange={e => setEditingOrder({...editingOrder, paidAmount: e.target.value})} className="mt-1 block w-full border-gray-300 border p-2 rounded-md bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-gray-800 text-lg">รายการสินค้า (Items)</h4>
                    <button type="button" onClick={() => handleAddItem(true)} className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 shadow-sm"><Plus className="w-4 h-4 mr-1" /> เพิ่มสินค้า</button>
                  </div>
                  {editingOrder.items && editingOrder.items.map((item: any, index: number) => (
                    <div key={index} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4 relative">
                      {editingOrder.items.length > 1 && <button type="button" onClick={() => handleRemoveItem(index, true)} className="absolute top-3 right-3 text-red-400 hover:text-red-600 bg-red-50 p-1.5 rounded-full"><Trash2 className="w-4 h-4" /></button>}
                      <div className="grid grid-cols-12 gap-3 pr-8">
                        <div className="col-span-12 sm:col-span-2"><label className="block text-xs text-gray-500 mb-1">SKU</label><input type="text" required value={item.productSku} onChange={e => handleItemChange(index, 'productSku', e.target.value, true)} className="block w-full border border-gray-300 p-2 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                        <div className="col-span-12 sm:col-span-3"><label className="block text-xs text-gray-500 mb-1">Product Name</label><input type="text" required value={item.productName} onChange={e => handleItemChange(index, 'productName', e.target.value, true)} className="block w-full border border-gray-300 p-2 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                        <div className="col-span-4 sm:col-span-2"><label className="block text-xs text-gray-500 mb-1">Unit Price</label><input type="number" min="0" required value={item.unitPrice} onChange={e => handleItemChange(index, 'unitPrice', e.target.value, true)} className="block w-full border border-gray-300 p-2 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                        <div className="col-span-4 sm:col-span-2"><label className="block text-xs text-gray-500 mb-1">Qty</label><input type="number" min="1" required value={item.qty} onChange={e => handleItemChange(index, 'qty', e.target.value, true)} className="block w-full border border-gray-300 p-2 rounded text-center font-bold shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                        <div className="col-span-4 sm:col-span-3"><label className="block text-xs text-gray-500 mb-1">สถานะ</label><select value={item.status || 'ระหว่างขนส่ง'} onChange={e => handleItemChange(index, 'status', e.target.value, true)} className="block w-full border border-gray-300 p-2 rounded bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500"><option value="ระหว่างขนส่ง">ระหว่างขนส่ง</option><option value="รับสินค้าแล้ว">รับสินค้าแล้ว</option><option value="สินค้ามีปัญหา">สินค้ามีปัญหา</option><option value="แจ้งเคลมแล้ว">แจ้งเคลมแล้ว</option></select></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-200 bg-white flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 sm:space-x-reverse shrink-0">
                <button type="button" onClick={() => setShowEditModal(false)} className="mt-3 sm:mt-0 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-6 py-2.5 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:w-auto">ยกเลิก</button>
                <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-6 py-2.5 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 sm:w-auto">บันทึกการแก้ไข</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}