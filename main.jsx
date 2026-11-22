
import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import {
  LayoutDashboard, ClipboardList, Users, Package, LogOut, Plus, Search,
  Menu, X, RefreshCw, Printer, ChevronRight, CircleDollarSign, Clock3,
  CheckCircle2, AlertCircle, ImagePlus, Eye, Trash2, History, Wallet,
  CalendarDays, Receipt, TrendingUp, BarChart3, FileText, MessageCircle, Link2, UserRound
} from 'lucide-react'
import './style.css'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = url && anon ? createClient(url, anon) : null

const money = v => Number(v || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
})

const dateBR = v => v
  ? new Date(v + 'T12:00:00').toLocaleDateString('pt-BR')
  : '—'

const localDate = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const productionStages = [
  'Aguardando preparação',
  'Preparação',
  'Estamparia',
  'Acabamento',
  'Conferência',
  'Pronto para entrega'
]

const getProductionStage = order => {
  const savedStage = order.production_details?.productionStage
  if (productionStages.includes(savedStage)) return savedStage
  if (order.status === 'Concluída') return 'Pronto para entrega'
  if (order.status === 'Em produção') return 'Preparação'
  return 'Aguardando preparação'
}

const sizeKeys = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG']
const getSizeTotal = sizes => sizeKeys.reduce((sum, size) => {
  const value = Number(sizes?.[size]) || 0
  return sum + (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0)
}, 0)
const getItemQuantity = item => getSizeTotal(item?.size_breakdown) || Number(item?.quantity) || 0
const getOrderItemsTotal = items => (items || []).reduce((sum, item) => {
  return sum + getItemQuantity(item) * (Number(item?.unit_price) || 0)
}, 0)
const formatDuration = minutes => {
  const value = Math.max(0, Math.floor(Number(minutes) || 0))
  const days = Math.floor(value / 1440)
  const hours = Math.floor((value % 1440) / 60)
  const mins = value % 60
  return [days ? `${days}d` : '', hours ? `${hours}h` : '', `${mins}min`].filter(Boolean).join(' ')
}
const elapsedMinutes = (from, to = new Date()) => from
  ? Math.max(0, Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 60000))
  : null

const emptyProduction = {
  fabric: 'Malha 30.1 penteada',
  fabricColor: '',
  garmentModel: 'Camiseta',
  printTechnique: 'Serigrafia base d’água',
  printColors: '',
  front: '',
  back: '',
  sleeves: '',
  sizes: '',
  colorBreakdown: '',
  instructions: '',
  checkedBy: '',
  productionBy: ''
}

const emptyOrder = () => ({
  client_id: '',
  status: 'Orçamento',
  due_date: '',
  notes: '',
  items: [{ product_id: '', description: '', quantity: 0, unit_price: 0, size_breakdown: {} }],
  production: { ...emptyProduction },
  mockupFile: null,
  removeMockup: false
})

const emptyPayment = () => ({
  amount: '',
  paid_at: localDate(),
  payment_method: 'Pix',
  notes: ''
})

function App() {
  const [session, setSession] = useState(null)
  const [page, setPage] = useState('dashboard')

  const [clients, setClients] = useState([])
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [payments, setPayments] = useState([])
  const [orderCosts, setOrderCosts] = useState([])
  const [expenses, setExpenses] = useState([])
  const [costForm, setCostForm] = useState({ work_order_id: '', category: 'Camisetas prontas', description: '', quantity: 1, unit_cost: '', cost_date: localDate(), notes: '' })
  const [expenseForm, setExpenseForm] = useState({ category: 'Energia', description: '', amount: '', expense_date: localDate(), payment_method: 'Pix', notes: '' })

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [search, setSearch] = useState('')
  const [productionFilterStage, setProductionFilterStage] = useState('Todas')
  const [productionFilterClient, setProductionFilterClient] = useState('Todos')
  const [productionFilterDue, setProductionFilterDue] = useState('Todos')

  const [modal, setModal] = useState('')
  const [editing, setEditing] = useState(null)
  const [paymentOrder, setPaymentOrder] = useState(null)
  const [paymentForm, setPaymentForm] = useState(emptyPayment())

  const [selectedOrder, setSelectedOrder] = useState(null)
  const [mockupPreview, setMockupPreview] = useState(null)
  const [selectedQuote, setSelectedQuote] = useState(null)
  const [profileClient, setProfileClient] = useState(null)
  const trackingToken = new URLSearchParams(window.location.search).get('acompanhar')
  const [publicTracking, setPublicTracking] = useState({ loading: Boolean(trackingToken), data: null, error: '' })
  const [publicTrackingUpdatedAt, setPublicTrackingUpdatedAt] = useState(null)

  const [financeFrom, setFinanceFrom] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [financeTo, setFinanceTo] = useState(localDate())

  const [clientForm, setClientForm] = useState({
    name: '', phone: '', whatsapp: '', document: '',
    email: '', address: '', notes: ''
  })

  const [productForm, setProductForm] = useState({
    name: '', category: 'Camiseta', description: '',
    base_price: '', active: true
  })

  const [orderForm, setOrderForm] = useState(emptyOrder())

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) loadAll()
  }, [session])

  async function refreshPublicTracking(showLoading = true) {
    if (!trackingToken || !supabase) return
    if (showLoading) setPublicTracking(current => ({ ...current, loading: true, error: '' }))
    const { data, error } = await supabase.rpc('get_public_order_tracking', { p_token: trackingToken })
    if (error || !data) {
      setPublicTracking({ loading: false, data: null, error: 'Este link não é válido ou o acompanhamento não está disponível. Solicite um novo link à DCS CONFECÇÃO.' })
    } else {
      setPublicTracking({ loading: false, data, error: '' })
      setPublicTrackingUpdatedAt(new Date())
    }
  }

  useEffect(() => {
    if (!trackingToken || !supabase) return
    refreshPublicTracking()
  }, [trackingToken])

  async function loadAll() {
    setBusy(true)
    setError('')

    try {
      const [c, p, o, pay, costs, exp] = await Promise.all([
        supabase.from('clients').select('*').order('name'),

        supabase.from('products')
          .select('*')
          .eq('active', true)
          .order('name'),

        supabase.from('work_orders')
          .select('*, clients(name,phone,whatsapp,email,address), work_order_items(*)')
          .order('created_at', { ascending: false }),

        supabase.from('work_order_payments')
          .select('*')
          .order('paid_at', { ascending: false }),

        supabase.from('work_order_costs')
          .select('*')
          .order('cost_date', { ascending: false }),

        supabase.from('general_expenses')
          .select('*')
          .order('expense_date', { ascending: false }),

      ])

      const err = c.error || p.error || o.error || pay.error || costs.error || exp.error
      if (err) throw err

      const loadedPayments = pay.data || []

      const loadedOrders = (o.data || []).map(order => ({
        ...order,
        payments: loadedPayments.filter(
          payment => payment.work_order_id === order.id
        )
      }))

      const withImages = await Promise.all(
        loadedOrders.map(async order => {
          if (!order.mockup_url) {
            return { ...order, mockupSignedUrl: '' }
          }

          const { data } = await supabase.storage
            .from('os-mockups')
            .createSignedUrl(order.mockup_url, 3600)

          return {
            ...order,
            mockupSignedUrl: data?.signedUrl || ''
          }
        })
      )

      setClients(c.data || [])
      setProducts(p.data || [])
      setOrders(withImages)
      setPayments(loadedPayments)
      setOrderCosts(costs.data || [])
      setExpenses(exp.data || [])
    } catch (err) {
      setError('Erro ao carregar os dados: ' + (err.message || 'Erro desconhecido'))
    } finally {
      setBusy(false)
    }
  }

  async function login(e) {
    e.preventDefault()
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) setError(error.message)
  }

  async function logout() {
    await supabase.auth.signOut()
    setSession(null)
  }

  function openClient(client = null) {
    setEditing(client)

    setClientForm(client
      ? { ...client }
      : {
          name: '', phone: '', whatsapp: '', document: '',
          email: '', address: '', notes: ''
        }
    )

    setModal('client')
  }

  function openProduct(product = null) {
    setEditing(product)

    setProductForm(product
      ? { ...product, base_price: String(product.base_price || 0) }
      : {
          name: '', category: 'Camiseta',
          description: '', base_price: '', active: true
        }
    )

    setModal('product')
  }

  function openOrder() {
    setEditing(null)
    setOrderForm(emptyOrder())
    setModal('order')
  }

  function editOrder(order) {
    setEditing(order)

    setOrderForm({
      client_id: order.client_id || '',
      status: order.status || 'Orçamento',
      due_date: order.due_date || '',
      notes: order.notes || '',

      items: (order.work_order_items || []).map(item => ({
        product_id: item.product_id || '',
        description: item.description || '',
        quantity: item.quantity ?? 0,
        unit_price: item.unit_price ?? 0,
        size_breakdown: item.size_breakdown || {},
        legacyQuantity: getSizeTotal(item.size_breakdown) === 0 && Number(item.quantity) > 0
      })),

      production: {
        ...emptyProduction,
        ...(order.production_details || {})
      },

      mockupFile: null,
      removeMockup: false
    })

    setModal('order')
  }

  function openPayments(order) {
    setPaymentOrder(order)
    setPaymentForm(emptyPayment())
    setModal('payment')
  }

  async function registerPayment(e) {
    e.preventDefault()

    if (!paymentOrder) return

    const amount = Number(paymentForm.amount)
    const total = Number(paymentOrder.total) || 0
    const received = Number(paymentOrder.amount_paid) || 0
    const balance = Math.max(0, total - received)

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Informe um valor de recebimento maior que zero.')
      return
    }

    if (amount > balance + 0.005) {
      setError(`O valor ultrapassa o saldo da OS. Saldo disponível: ${money(balance)}`)
      return
    }

    setBusy(true)
    setError('')

    try {
      const { error: paymentError } = await supabase.rpc(
        'register_work_order_payment',
        {
          p_work_order_id: paymentOrder.id,
          p_amount: amount,
          p_paid_at: paymentForm.paid_at,
          p_payment_method: paymentForm.payment_method,
          p_notes: paymentForm.notes || null
        }
      )

      if (paymentError) throw paymentError

      setNotice(`Recebimento de ${money(amount)} registrado na OS #${String(paymentOrder.number).padStart(5, '0')}.`)
      setModal('')
      setPaymentOrder(null)

      await loadAll()
    } catch (err) {
      setError('Não foi possível registrar o recebimento: ' + (err.message || 'Erro desconhecido'))
    } finally {
      setBusy(false)
    }
  }

  async function deleteOrder(order) {
    const confirmed = window.confirm(
      `Excluir definitivamente a OS #${String(order.number).padStart(5, '0')}? OS com recebimentos ou custos vinculados não podem ser excluídas; nesses casos, use o status Cancelada.`
    )

    if (!confirmed) return

    setBusy(true)
    setError('')

    try {
      const { error: orderError } = await supabase
        .from('work_orders')
        .delete()
        .eq('id', order.id)

      if (orderError) throw orderError

      if (order.mockup_url) {
        await supabase.storage.from('os-mockups').remove([order.mockup_url])
      }

      setNotice('OS excluída com sucesso.')
      await loadAll()
    } catch (err) {
      setError('Não foi possível excluir a OS: ' + (err.message || 'Erro desconhecido'))
    } finally {
      setBusy(false)
    }
  }

  async function saveClient(e) {
    e.preventDefault()
    setBusy(true)
    setError('')

    try {
      const query = editing
        ? supabase.from('clients').update(clientForm).eq('id', editing.id)
        : supabase.from('clients').insert(clientForm)

      const { error } = await query
      if (error) throw error

      setNotice('Cliente salvo com sucesso.')
      setModal('')
      await loadAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveProduct(e) {
    e.preventDefault()
    setBusy(true)
    setError('')

    try {
      const payload = {
        ...productForm,
        base_price: Number(productForm.base_price || 0)
      }

      const query = editing
        ? supabase.from('products').update(payload).eq('id', editing.id)
        : supabase.from('products').insert(payload)

      const { error } = await query
      if (error) throw error

      setNotice('Produto salvo com sucesso.')
      setModal('')
      await loadAll()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveOrder(e) {
    e.preventDefault()
    setBusy(true)
    setError('')

    try {
      const items = orderForm.items
        .filter(item => item.description.trim())
        .map(item => {
          const gridQuantity = getSizeTotal(item.size_breakdown)
          const legacyQuantity = item.legacyQuantity ? Number(item.quantity) || 0 : 0
          return {
            product_id: item.product_id || null,
            description: item.description.trim(),
            quantity: gridQuantity || legacyQuantity,
            unit_price: Number(item.unit_price),
            size_breakdown: item.size_breakdown || {}
          }
        })

      if (!items.length) {
        throw new Error('Adicione pelo menos um item à OS.')
      }

      if (items.some(item => item.quantity <= 0 || item.unit_price < 0)) {
        throw new Error('Preencha pelo menos um tamanho na grade de cada item novo. A quantidade é calculada automaticamente pela soma dos tamanhos. Confira também o valor unitário.')
      }

      const total = items.reduce(
        (sum, item) => sum + item.quantity * item.unit_price,
        0
      )

      // Preserva todos os recebimentos anteriores.
      // Pagamentos novos só podem ser registrados pelo módulo de recebimentos.
      const amountPaid = editing
        ? Number(editing.amount_paid) || 0
        : 0

      if (amountPaid > total + 0.005) {
        throw new Error(
          `O novo total (${money(total)}) não pode ser menor que o valor já recebido (${money(amountPaid)}).`
        )
      }

      const paymentStatus = amountPaid >= total && total > 0
        ? 'Pago'
        : amountPaid > 0
          ? 'Parcial'
          : 'Pendente'

      const payload = {
        client_id: orderForm.client_id || null,
        status: orderForm.status,
        due_date: orderForm.due_date || null,
        notes: orderForm.notes,
        payment_status: paymentStatus,
        total,
        amount_paid: amountPaid,
        production_details: orderForm.production
      }

      const currentMockupPath = editing?.mockup_url || null
      const { data: savedOrderId, error: atomicSaveError } = await supabase.rpc(
        'kalango_save_work_order_atomic',
        {
          p_work_order_id: editing?.id || null,
          p_payload: payload,
          p_items: items
        }
      )
      if (atomicSaveError) throw atomicSaveError
      const orderId = savedOrderId
      if (!editing?.public_tracking_token) {
        const token = crypto.randomUUID()
        const { error: tokenError } = await supabase.from('work_orders').update({ public_tracking_token: token }).eq('id', orderId)
        if (tokenError) throw new Error('OS salva, mas não foi possível habilitar o link de acompanhamento: ' + tokenError.message)
      }

      if (orderForm.mockupFile) {
        const file = orderForm.mockupFile
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
        const path = `${session.user.id}/${orderId}/${Date.now()}-${safeName}`

        const { error: uploadError } = await supabase.storage
          .from('os-mockups')
          .upload(path, file, {
            upsert: false,
            contentType: file.type
          })

        if (uploadError) {
          throw new Error('OS salva, mas não foi possível enviar o mockup: ' + uploadError.message)
        }

        const { error: imageUpdateError } = await supabase
          .from('work_orders')
          .update({ mockup_url: path })
          .eq('id', orderId)

        if (imageUpdateError) {
          throw new Error('Imagem enviada, mas não foi possível vinculá-la à OS: ' + imageUpdateError.message)
        }

        if (currentMockupPath) {
          await supabase.storage.from('os-mockups').remove([currentMockupPath])
        }
      } else if (editing && orderForm.removeMockup && currentMockupPath) {
        const { error: imageUpdateError } = await supabase
          .from('work_orders')
          .update({ mockup_url: null })
          .eq('id', orderId)

        if (imageUpdateError) throw imageUpdateError

        await supabase.storage.from('os-mockups').remove([currentMockupPath])
      }

      setNotice(editing ? 'OS atualizada com sucesso.' : 'OS criada com sucesso.')
      setModal('')
      await loadAll()
    } catch (err) {
      setError(err.message || 'Erro ao salvar a OS.')
    } finally {
      setBusy(false)
    }
  }

  async function saveOrderCost(e) {
    e.preventDefault()
    const quantity = Number(costForm.quantity)
    const unitCost = Number(costForm.unit_cost)
    if (!costForm.work_order_id) return setError('Selecione a OS vinculada ao custo.')
    if (!costForm.description.trim()) return setError('Informe a descrição do custo.')
    if (!(quantity > 0) || !(unitCost >= 0)) return setError('Confira a quantidade e o custo unitário.')
    setBusy(true); setError('')
    try {
      const { error } = await supabase.from('work_order_costs').insert({
        work_order_id: costForm.work_order_id,
        category: costForm.category,
        description: costForm.description.trim(),
        quantity,
        unit_cost: unitCost,
        total_cost: quantity * unitCost,
        cost_date: costForm.cost_date || localDate(),
        notes: costForm.notes || null
      })
      if (error) throw error
      setCostForm({ work_order_id: '', category: 'Camisetas prontas', description: '', quantity: 1, unit_cost: '', cost_date: localDate(), notes: '' })
      setNotice('Custo da OS registrado com sucesso.')
      await loadAll()
    } catch (err) { setError('Não foi possível salvar o custo: ' + (err.message || 'Erro desconhecido')) }
    finally { setBusy(false) }
  }

  async function deleteOrderCost(cost) {
    if (!window.confirm(`Excluir o custo “${cost.description}”?`)) return
    setBusy(true); setError('')
    try {
      const { error } = await supabase.from('work_order_costs').delete().eq('id', cost.id)
      if (error) throw error
      setNotice('Custo excluído.')
      await loadAll()
    } catch (err) { setError('Não foi possível excluir: ' + (err.message || 'Erro desconhecido')) }
    finally { setBusy(false) }
  }

  async function saveExpense(e) {
    e.preventDefault()
    const amount = Number(expenseForm.amount)
    if (!expenseForm.description.trim() || !(amount > 0)) return setError('Informe a descrição e um valor maior que zero.')
    setBusy(true); setError('')
    try {
      const { error } = await supabase.from('general_expenses').insert({
        category: expenseForm.category,
        description: expenseForm.description.trim(),
        amount,
        expense_date: expenseForm.expense_date || localDate(),
        payment_method: expenseForm.payment_method,
        notes: expenseForm.notes || null
      })
      if (error) throw error
      setExpenseForm({ category: 'Energia', description: '', amount: '', expense_date: localDate(), payment_method: 'Pix', notes: '' })
      setNotice('Despesa registrada com sucesso.')
      await loadAll()
    } catch (err) { setError('Não foi possível salvar a despesa: ' + (err.message || 'Erro desconhecido')) }
    finally { setBusy(false) }
  }

  async function deleteExpense(expense) {
    if (!window.confirm(`Excluir a despesa “${expense.description}”?`)) return
    setBusy(true); setError('')
    try {
      const { error } = await supabase.from('general_expenses').delete().eq('id', expense.id)
      if (error) throw error
      setNotice('Despesa excluída.')
      await loadAll()
    } catch (err) { setError('Não foi possível excluir: ' + (err.message || 'Erro desconhecido')) }
    finally { setBusy(false) }
  }

  async function changeStatus(id, status) {
    const { error } = await supabase
      .from('work_orders')
      .update({ status })
      .eq('id', id)

    if (error) setError(error.message)
    else await loadAll()
  }

  async function changeProductionStage(order, productionStage) {
    setBusy(true)
    setError('')

    try {
      const previousDetails = order.production_details || {}
      const previousStage = getProductionStage(order)
      const changedAt = new Date().toISOString()
      const stageHistory = Array.isArray(previousDetails.stageHistory)
        ? [...previousDetails.stageHistory]
        : []
      if (previousStage !== productionStage) {
        stageHistory.push({
          stage: previousStage,
          startedAt: previousDetails.stageStartedAt || null,
          endedAt: changedAt,
          durationMinutes: elapsedMinutes(previousDetails.stageStartedAt, changedAt)
        })
      }
      const productionDetails = {
        ...previousDetails,
        productionStage,
        stageHistory,
        stageStartedAt: previousStage === productionStage
          ? (previousDetails.stageStartedAt || changedAt)
          : changedAt,
        productionStartedAt: previousDetails.productionStartedAt || changedAt,
        productionCompletedAt: productionStage === 'Pronto para entrega'
          ? changedAt
          : (previousDetails.productionCompletedAt || null)
      }

      const nextOrderStatus = productionStage === 'Aguardando preparação'
        ? 'Aprovada'
        : productionStage === 'Pronto para entrega'
          ? 'Concluída'
          : 'Em produção'

      const { error } = await supabase
        .from('work_orders')
        .update({
          production_details: productionDetails,
          status: nextOrderStatus
        })
        .eq('id', order.id)

      if (error) throw error

      setNotice(`Etapa da OS #${String(order.number).padStart(5, '0')} atualizada.`)
      await loadAll()
    } catch (err) {
      setError('Não foi possível atualizar a etapa: ' + (err.message || 'Erro desconhecido'))
    } finally {
      setBusy(false)
    }
  }

  async function saveProductionResponsible(order, stage, responsible) {
    const previousDetails = order.production_details || {}
    const stageAssignments = { ...(previousDetails.stageAssignments || {}), [stage]: responsible.trim() }
    const nextDetails = { ...previousDetails, stageAssignments }
    const { error } = await supabase
      .from('work_orders')
      .update({ production_details: nextDetails })
      .eq('id', order.id)
    if (error) {
      setError('Não foi possível salvar o responsável: ' + error.message)
      return
    }
    setOrders(current => current.map(item => item.id === order.id
      ? { ...item, production_details: nextDetails }
      : item))
    setNotice(`Responsável da OS #${String(order.number).padStart(5, '0')} atualizado.`)
  }

  function trackingUrl(order) {
    if (!order?.public_tracking_token) return ''
    return `${window.location.origin}${window.location.pathname}?acompanhar=${order.public_tracking_token}`
  }

  async function copyTrackingLink(order) {
    const link = trackingUrl(order)
    if (!link) return setError('Link ainda não disponível. Execute a migração SQL da atualização.')
    try { await navigator.clipboard.writeText(link); setNotice('Link de acompanhamento copiado.') }
    catch { setError('Não foi possível copiar automaticamente. Abra o link pelo botão de compartilhamento.') }
  }

  function whatsappMessage(order, kind = 'status') {
    const rawPhone = String(order.clients?.whatsapp || order.clients?.phone || '').replace(/\D/g, '')
    const phone = rawPhone && rawPhone.length <= 11 ? `55${rawPhone}` : rawPhone
    if (!phone) return setError('Este cliente não possui telefone/WhatsApp cadastrado.')
    const number = `#${String(order.number).padStart(5, '0')}`
    const link = trackingUrl(order)
    const text = kind === 'quote'
      ? `Olá, ${order.clients?.name || ''}! Segue o orçamento ${number} da DCS CONFECÇÃO, no valor de ${money(order.total)}. Prazo previsto: ${dateBR(order.due_date)}. Qualquer dúvida, estamos à disposição.`
      : `Olá, ${order.clients?.name || ''}! Atualização do seu pedido ${number}: ${order.status}. Etapa atual: ${getProductionStage(order)}. Previsão: ${dateBR(order.due_date)}.${link ? ` Acompanhe por aqui: ${link}` : ''}`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  function openQuotePrint(order) {
    setSelectedQuote(order)
    setTimeout(() => window.print(), 180)
  }

  function printOrder(order) {
    setSelectedOrder(order)
    setTimeout(() => window.print(), 150)
  }

  const filteredClients = clients.filter(client =>
    (client.name + ' ' + (client.phone || ''))
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  const filteredProducts = products.filter(product =>
    (product.name + ' ' + (product.category || ''))
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  const filteredOrders = orders.filter(order =>
    String(order.number).includes(search) ||
    (order.clients?.name || '').toLowerCase().includes(search.toLowerCase())
  )

  const today = localDate()

  const productionOrders = orders
    .filter(order => ['Aprovada', 'Em produção', 'Concluída'].includes(order.status))
    .sort((a, b) => {
      const aDate = a.due_date || '9999-12-31'
      const bDate = b.due_date || '9999-12-31'
      return aDate.localeCompare(bDate)
    })

  const productionStageCounts = productionStages.map(stage => ({
    stage,
    count: productionOrders.filter(order => getProductionStage(order) === stage).length
  }))
  const productionLateOrders = productionOrders.filter(order =>
    order.due_date && order.due_date < today && !['Concluída', 'Entregue', 'Cancelada'].includes(order.status)
  )
  const filteredProductionOrders = productionOrders.filter(order => {
    const stageMatch = productionFilterStage === 'Todas' || getProductionStage(order) === productionFilterStage
    const clientMatch = productionFilterClient === 'Todos' || order.client_id === productionFilterClient
    const late = order.due_date && order.due_date < today && !['Concluída', 'Entregue', 'Cancelada'].includes(order.status)
    const dueMatch = productionFilterDue === 'Todos' || (productionFilterDue === 'Atrasadas' ? late : productionFilterDue === 'No prazo' ? !late : order.due_date === today)
    return stageMatch && clientMatch && dueMatch
  })

  const totalOpen = orders.filter(order =>
    !['Concluída', 'Cancelada', 'Entregue'].includes(order.status)
  ).length

  const totalProduction = orders.filter(
    order => order.status === 'Em produção'
  ).length

  const totalValue = orders.reduce(
    (sum, order) => sum + Number(order.total || 0), 0
  )

  const financialOrders = orders.filter(
    order => order.status !== 'Cancelada'
  )

  const getReceived = order => Number(order.amount_paid) || 0

  const financeTotal = financialOrders.reduce(
    (sum, order) => sum + (Number(order.total) || 0), 0
  )

  const financeReceived = financialOrders.reduce(
    (sum, order) => sum + getReceived(order), 0
  )

  const financeBalance = Math.max(0, financeTotal - financeReceived)


  const receivables = financialOrders
    .map(order => ({
      ...order,
      receivedValue: getReceived(order),
      balanceValue: Math.max(
        0,
        (Number(order.total) || 0) - getReceived(order)
      )
    }))
    .filter(order => order.balanceValue > 0)
    .sort((a, b) =>
      (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31')
    )

  const lateOrders = receivables.filter(
    order => order.due_date && order.due_date < today
  )

  const currentMonth = today.slice(0, 7)

  const monthOrdersValue = financialOrders
    .filter(order => (order.created_at || '').slice(0, 7) === currentMonth)
    .reduce((sum, order) => sum + (Number(order.total) || 0), 0)

  // Os lançamentos do histórico são os pagamentos feitos após a implantação.
  // Os valores antigos permanecem no acumulado, sem receber datas inventadas.
  const periodPayments = payments.filter(payment =>
    payment.paid_at >= financeFrom &&
    payment.paid_at <= financeTo
  )

  const periodReceived = periodPayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0), 0
  )

  const periodPaymentCount = periodPayments.length

  const orderCostTotals = orderCosts.reduce((acc, cost) => {
    acc[cost.work_order_id] = (acc[cost.work_order_id] || 0) + Number(cost.total_cost || (Number(cost.quantity || 1) * Number(cost.unit_cost || 0)))
    return acc
  }, {})
  const totalOrderCosts = orderCosts.reduce((sum, cost) => sum + Number(cost.total_cost || (Number(cost.quantity || 1) * Number(cost.unit_cost || 0))), 0)
  const totalGeneralExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  const totalRevenue = financialOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
  const totalOperatingResult = totalRevenue - totalOrderCosts - totalGeneralExpenses
  const profitOrders = financialOrders.map(order => {
    const cost = orderCostTotals[order.id] || 0
    const revenue = Number(order.total || 0)
    return { ...order, costTotal: cost, profit: revenue - cost, margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0 }
  })
  const periodExpenses = expenses.filter(item => item.expense_date >= financeFrom && item.expense_date <= financeTo)
  const periodExpenseTotal = periodExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const periodOrderCosts = orderCosts.filter(item => item.cost_date >= financeFrom && item.cost_date <= financeTo).reduce((sum, item) => sum + Number(item.total_cost || (Number(item.quantity || 1) * Number(item.unit_cost || 0))), 0)
  const periodOperatingResult = periodReceived - periodOrderCosts - periodExpenseTotal

  const periodOrders = financialOrders.filter(order => {
    const date = (order.created_at || '').slice(0, 10)
    return date >= financeFrom && date <= financeTo
  })
  const periodOrderRevenue = periodOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
  const periodPieces = periodOrders.reduce((sum, order) => sum + (order.work_order_items || []).reduce((subtotal, item) => subtotal + getItemQuantity(item), 0), 0)
  const reportStatusCounts = ['Orçamento', 'Aguardando aprovação', 'Aprovada', 'Em produção', 'Concluída', 'Entregue', 'Cancelada'].map(status => ({
    status,
    count: periodOrders.filter(order => order.status === status).length
  })).filter(item => item.count > 0)
  const reportTopClients = Object.values(periodOrders.reduce((acc, order) => {
    const name = order.clients?.name || 'Cliente não informado'
    if (!acc[name]) acc[name] = { name, orders: 0, revenue: 0, pieces: 0 }
    acc[name].orders += 1
    acc[name].revenue += Number(order.total || 0)
    acc[name].pieces += (order.work_order_items || []).reduce((subtotal, item) => subtotal + getItemQuantity(item), 0)
    return acc
  }, {})).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  const reportMonths = Array.from({ length: 6 }, (_, index) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - (5 - index))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    const monthOrders = financialOrders.filter(order => (order.created_at || '').slice(0, 7) === key)
    const revenue = monthOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
    const received = payments.filter(payment => (payment.paid_at || '').slice(0, 7) === key).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    const costs = orderCosts.filter(cost => (cost.cost_date || '').slice(0, 7) === key).reduce((sum, cost) => sum + Number(cost.total_cost || (Number(cost.quantity || 1) * Number(cost.unit_cost || 0))), 0)
    const general = expenses.filter(expense => (expense.expense_date || '').slice(0, 7) === key).reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
    return { key, label, revenue, received, costs, general, result: received - costs - general }
  })

  if (trackingToken) {
    const data = publicTracking.data
    const stages = ['Aguardando preparação', 'Preparação', 'Estamparia', 'Acabamento', 'Conferência', 'Pronto para entrega']
    const currentStage = data?.production_stage || (data?.status === 'Concluída' || data?.status === 'Entregue' ? 'Pronto para entrega' : data?.status === 'Em produção' ? 'Preparação' : 'Aguardando preparação')
    const stageIndex = Math.max(0, stages.indexOf(currentStage))
    const isCancelled = data?.status === 'Cancelada'
    const progress = data?.status === 'Entregue' ? 100 : isCancelled ? 0 : Math.round(((stageIndex + 1) / stages.length) * 100)
    return (
      <div className="client-portal-wrap">
        <main className="client-portal">
          <header className="client-portal-header">
            <div className="client-portal-brand"><div className="brand-mark">D</div><div><b>DCS CONFECÇÃO</b><small>PORTAL DO CLIENTE</small></div></div>
            <span className="client-portal-secure">Acompanhamento online</span>
          </header>
          <section className="client-portal-intro">
            <p className="eyebrow">ÁREA DE ACOMPANHAMENTO</p>
            <h1>Seu pedido, sempre atualizado.</h1>
            <p>Consulte o andamento da produção e a previsão de entrega do seu pedido.</p>
          </section>
          {publicTracking.loading && !data ? <section className="client-portal-panel client-portal-loading"><div className="portal-spinner"/><b>Buscando seu pedido...</b><span>Isso pode levar alguns segundos.</span></section> : publicTracking.error ? <section className="client-portal-panel client-portal-error"><div className="portal-error-icon">!</div><h2>Não foi possível localizar o pedido</h2><p>{publicTracking.error}</p></section> : data ? <>
            <section className="client-portal-panel client-order-summary">
              <div className="client-order-top"><div><span className="portal-label">NÚMERO DO PEDIDO</span><strong className="client-order-number">#{String(data.number).padStart(5, '0')}</strong></div><span className={`client-order-badge ${isCancelled ? 'cancelled' : data.status === 'Entregue' ? 'delivered' : ''}`}>{data.status || 'Em acompanhamento'}</span></div>
              <div className="client-order-info"><div><span className="portal-label">ETAPA ATUAL</span><b>{currentStage}</b></div><div><span className="portal-label">PREVISÃO DE ENTREGA</span><b>{dateBR(data.due_date)}</b></div></div>
              {!isCancelled && <div className="portal-progress-area"><div className="portal-progress-caption"><span>Progresso da produção</span><b>{progress}%</b></div><div className="public-track-progress"><span style={{width: `${progress}%`}} /></div></div>}
            </section>
            {!isCancelled && <section className="client-portal-panel">
              <div className="portal-section-heading"><div><span className="portal-label">ACOMPANHAMENTO</span><h2>Etapas do pedido</h2></div><span className="portal-live-dot">Atualizado</span></div>
              <ol className="portal-timeline">{stages.map((stage, index) => {
                const completed = data.status === 'Entregue' || index < stageIndex || (data.status === 'Concluída' && index === stages.length - 1)
                const active = data.status !== 'Entregue' && index === stageIndex
                return <li key={stage} className={`${completed ? 'completed' : ''} ${active ? 'active' : ''}`}><span className="portal-timeline-marker">{completed ? '✓' : index + 1}</span><div><b>{stage}</b>{active && <small>Etapa atual do seu pedido</small>}</div></li>
              })}</ol>
            </section>}
            {isCancelled && <section className="client-portal-panel portal-cancelled-note"><b>Pedido cancelado</b><p>Entre em contato com a DCS CONFECÇÃO caso precise de mais informações.</p></section>}
            <section className="client-portal-footer"><p>As informações deste portal são fornecidas pela equipe da DCS CONFECÇÃO.</p><button className="portal-refresh-button" onClick={() => refreshPublicTracking()} disabled={publicTracking.loading}>{publicTracking.loading ? 'Atualizando...' : '↻ Atualizar acompanhamento'}</button>{publicTrackingUpdatedAt && <small>Última consulta: {publicTrackingUpdatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>}</section>
          </> : null}
          <footer className="client-portal-bottom">DCS CONFECÇÃO · Atendimento e produção</footer>
        </main>
      </div>
    )
  }

  if (!supabase) return <SetupScreen />

  if (!session) {
    return (
      <div className="login-wrap">
        <form className="login-card" onSubmit={login}>
          <div className="brand-mark">D</div>
          <p className="eyebrow">DCS CONFECÇÃO</p>
          <h1>Gestão</h1>
          <p className="muted">Entre para acessar suas ordens de serviço.</p>

          <label>
            E-mail
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Sua senha"
            />
          </label>

          {error && <p className="error">{error}</p>}
          <button className="primary full">Entrar</button>
          <small className="muted">Acesso restrito aos usuários cadastrados.</small>
        </form>
      </div>
    )
  }

  const nav = [
    ['dashboard', 'Painel', LayoutDashboard],
    ['orders', 'Ordens de serviço', ClipboardList],
    ['quotes', 'Orçamentos', FileText],
    ['production', 'Produção', CheckCircle2],
    ['finance', 'Financeiro', CircleDollarSign],
    ['costs', 'Custos e lucro', TrendingUp],
    ['expenses', 'Despesas', Receipt],
    ['reports', 'Relatórios', BarChart3],
    ['clients', 'Clientes', Users],
    ['products', 'Produtos', Package]
  ]

  return (
    <div className="app-shell" data-page={page}>
      <aside className={`sidebar ${mobileNav ? 'show' : ''}`}>
        <div className="brand">
          <div className="brand-mark">D</div>
          <div>
            <b>DCS CONFECÇÃO</b>
            <small>GESTÃO</small>
          </div>
          <button
            className="icon-btn mobile-close"
            onClick={() => setMobileNav(false)}
          >
            <X />
          </button>
        </div>

        <div className="nav-label">MENU PRINCIPAL</div>

        {nav.map(([id, label, Icon]) => (
          <button
            key={id}
            className={`nav-item ${page === id ? 'active' : ''}`}
            onClick={() => {
              setPage(id)
              setSearch('')
              setMobileNav(false)
            }}
          >
            <Icon size={19} />
            {label}
          </button>
        ))}

        <div className="sidebar-bottom">
          <div className="user-chip">
            <div className="avatar">
              {session.user.email?.[0]?.toUpperCase()}
            </div>
            <div className="user-meta">
              <b>Usuário</b>
              <small>{session.user.email}</small>
            </div>
          </div>

          <button className="nav-item" onClick={logout}>
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      {mobileNav && (
        <div className="scrim" onClick={() => setMobileNav(false)} />
      )}

      <main className="main">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            onClick={() => setMobileNav(true)}
          >
            <Menu />
          </button>

          <div>
            <span className="eyebrow">DCS CONFECÇÃO</span>
            <h2>{nav.find(item => item[0] === page)?.[1]}</h2>
          </div>

          <button
            className="icon-btn"
            onClick={loadAll}
            title="Atualizar"
          >
            <RefreshCw size={18} />
          </button>
        </header>

        {notice && (
          <div className="notice" onClick={() => setNotice('')}>
            {notice}
            <X size={14} />
          </div>
        )}

        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => setError('')}>
              <X size={14} />
            </button>
          </div>
        )}

        {page === 'dashboard' && (
          <>
            <section className="welcome">
              <div>
                <p className="eyebrow">VISÃO GERAL</p>
                <h1>Bom trabalho!</h1>
                <p>Acompanhe os pedidos e a produção da confecção.</p>
              </div>
              <button className="primary" onClick={openOrder}>
                <Plus size={18} />
                Nova OS
              </button>
            </section>

            <section className="stats">
              <Stat icon={ClipboardList} label="OS em aberto" value={totalOpen} />
              <Stat icon={Clock3} label="Em produção" value={totalProduction} />
              <Stat icon={CircleDollarSign} label="Valor total das OS" value={money(totalValue)} />
              <Stat icon={Users} label="Clientes cadastrados" value={clients.length} />
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>Ordens recentes</h3>
                  <p className="muted">Últimos pedidos cadastrados</p>
                </div>
                <button className="text-btn" onClick={() => setPage('orders')}>
                  Ver todas <ChevronRight size={16} />
                </button>
              </div>

              <OrderTable
                orders={orders.slice(0, 6)}
                changeStatus={changeStatus}
                onView={printOrder}
                onMockup={setMockupPreview}
                onEdit={editOrder}
                onDelete={deleteOrder}
                onPayments={openPayments}
                onMessage={whatsappMessage}
                onTracking={copyTrackingLink}
              />
            </section>
          </>
        )}

        {page === 'orders' && (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>Ordens de serviço</h3>
                <p className="muted">Controle seus pedidos do orçamento à entrega.</p>
              </div>
              <button className="primary" onClick={openOrder}>
                <Plus size={17} />
                Nova OS
              </button>
            </div>

            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Buscar por número ou cliente"
            />

            <OrderTable
              orders={filteredOrders}
              changeStatus={changeStatus}
              onView={printOrder}
              onMockup={setMockupPreview}
              onEdit={editOrder}
              onDelete={deleteOrder}
              onPayments={openPayments}
                onMessage={whatsappMessage}
                onTracking={copyTrackingLink}
            />
          </section>
        )}

        {page === 'quotes' && (
          <section className="panel">
            <div className="panel-head"><div><h3>Orçamentos</h3><p className="muted">Orçamentos são OS com status Orçamento ou Aguardando aprovação. Aprove um orçamento alterando o status para Aprovada.</p></div><button className="primary" onClick={openOrder}><Plus size={16}/> Novo orçamento</button></div>
            <div className="table-wrap"><table><thead><tr><th>Número</th><th>Cliente</th><th>Data</th><th>Entrega prevista</th><th>Valor</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
              {orders.filter(o => ['Orçamento','Aguardando aprovação'].includes(o.status)).map(order => <tr key={order.id}><td><b>#{String(order.number).padStart(5,'0')}</b></td><td>{order.clients?.name || '—'}</td><td>{dateBR(order.created_at?.slice(0,10))}</td><td>{dateBR(order.due_date)}</td><td>{money(order.total)}</td><td>{order.status}</td><td><div className="order-actions"><button className="secondary small" onClick={()=>openQuotePrint(order)}><Printer size={14}/> PDF / imprimir</button><button className="secondary small" onClick={()=>whatsappMessage(order,'quote')}><MessageCircle size={14}/> Enviar</button><button className="secondary small" onClick={()=>changeStatus(order.id,'Aprovada')}><CheckCircle2 size={13}/> Aprovar</button><button className="secondary small" onClick={()=>editOrder(order)}>Editar</button></div></td></tr>)}
            </tbody></table>{!orders.some(o=>['Orçamento','Aguardando aprovação'].includes(o.status)) && <Empty text="Nenhum orçamento pendente."/>}</div>
          </section>
        )}

        {page === 'production' && (
          <>
            <section className="welcome">
              <div>
                <p className="eyebrow">ACOMPANHAMENTO DA OFICINA</p>
                <h1>Controle de produção</h1>
                <p>Acompanhe cada OS aprovada até ficar pronta para entrega.</p>
              </div>
              <button className="secondary" onClick={loadAll} disabled={busy}>
                <RefreshCw size={16} /> Atualizar produção
              </button>
            </section>

            <section className="stats production-summary-stats">
              <Stat icon={ClipboardList} label="OS na fila" value={productionOrders.length} />
              <Stat icon={AlertCircle} label="OS atrasadas" value={productionLateOrders.length} />
              <Stat icon={Clock3} label="Em produção" value={productionOrders.filter(order => order.status === 'Em produção').length} />
            </section>

            <section className="production-stage-cards">
              {productionStageCounts.map(({ stage, count }) => (
                <div className="production-stage-card" key={stage}>
                  <span>{stage}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>Fila de produção</h3>
                  <p className="muted">OS aprovadas, em produção ou concluídas aguardando entrega.</p>
                </div>
                <span className="finance-count">{productionOrders.length} OS</span>
              </div>

              <div className="form-grid production-filters">
                <label>Etapa
                  <select value={productionFilterStage} onChange={e => setProductionFilterStage(e.target.value)}>
                    <option>Todas</option>
                    {productionStages.map(stage => <option key={stage}>{stage}</option>)}
                  </select>
                </label>
                <label>Cliente
                  <select value={productionFilterClient} onChange={e => setProductionFilterClient(e.target.value)}>
                    <option value="Todos">Todos os clientes</option>
                    {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                  </select>
                </label>
                <label>Prazo
                  <select value={productionFilterDue} onChange={e => setProductionFilterDue(e.target.value)}>
                    <option value="Todos">Todos os prazos</option>
                    <option value="Atrasadas">Atrasadas</option>
                    <option value="Hoje">Entrega hoje</option>
                    <option value="No prazo">No prazo</option>
                  </select>
                </label>
                <label>Busca
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Número da OS ou cliente" />
                </label>
              </div>

              <div className="table-wrap">
                <table className="production-table">
                  <thead>
                    <tr>
                      <th>Ordem</th>
                      <th>Cliente</th>
                      <th>Entrega prevista</th>
                      <th>Detalhes</th>
                      <th>Etapa de produção</th>
                      <th>Responsável</th>
                      <th>Status da OS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProductionOrders.filter(order => !search || String(order.number).includes(search) || (order.clients?.name || '').toLowerCase().includes(search.toLowerCase())).map(order => {
                      const overdue = order.due_date && order.due_date < today && !['Concluída', 'Entregue', 'Cancelada'].includes(order.status)
                      const details = order.production_details || {}
                      const itemSummary = (order.work_order_items || [])
                        .map(item => `${getItemQuantity(item)}x ${item.description}`)
                        .join(' · ')

                      return (
                        <tr key={order.id}>
                          <td><b>#{String(order.number).padStart(5, '0')}</b></td>
                          <td>{order.clients?.name || 'Cliente não informado'}</td>
                          <td>
                            <span className={overdue ? 'production-overdue' : ''}>
                              {dateBR(order.due_date)}
                              {overdue && <small className="production-alert">Atrasada</small>}
                            </span>
                          </td>
                          <td className="production-detail-cell">
                            <b>{details.garmentModel || 'Peça não informada'}</b>
                            <small>{itemSummary || details.sizes || 'Sem descrição dos itens'}</small>
                            <small>{details.printTechnique || 'Técnica não informada'}</small>
                            <small>{details.stageStartedAt ? `Nesta etapa há ${formatDuration(elapsedMinutes(details.stageStartedAt))}` : 'Etapa sem início registrado'}</small>
                            {details.stageHistory?.length > 0 && <small>Última mudança: {new Date(details.stageHistory[details.stageHistory.length - 1].endedAt).toLocaleString('pt-BR')}</small>}
                          </td>
                          <td>
                            <select
                              className="production-stage-select"
                              value={getProductionStage(order)}
                              disabled={busy}
                              onChange={e => changeProductionStage(order, e.target.value)}
                            >
                              {productionStages.map(stage => <option key={stage}>{stage}</option>)}
                            </select>
                          </td>
                          <td><input className="production-responsible-input" aria-label={`Responsável pela etapa da OS ${order.number}`} defaultValue={details.stageAssignments?.[getProductionStage(order)] || ''} placeholder="Nome do responsável" onBlur={e => saveProductionResponsible(order, getProductionStage(order), e.target.value)} /></td>
                          <td><span className="production-order-status">{order.status}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {!productionOrders.length && (
                <Empty text="Nenhuma OS aprovada ou em produção no momento." />
              )}
              {productionOrders.length > 0 && !filteredProductionOrders.filter(order => !search || String(order.number).includes(search) || (order.clients?.name || '').toLowerCase().includes(search.toLowerCase())).length && (
                <Empty text="Nenhuma OS corresponde aos filtros selecionados." />
              )}
            </section>
          </>
        )}

        {page === 'finance' && (
          <>
            <section className="welcome">
              <div>
                <p className="eyebrow">CONTROLE FINANCEIRO</p>
                <h1>Financeiro</h1>
                <p>Acompanhe valores das OS, recebimentos e saldos pendentes.</p>
              </div>
              <button className="primary" onClick={() => setPage('orders')}>
                <ClipboardList size={17} />
                Ver ordens
              </button>
            </section>

            <section className="stats finance-stats">
              <Stat
                icon={CircleDollarSign}
                label="Total contratado (OS ativas)"
                value={money(financeTotal)}
              />
              <Stat
                icon={CheckCircle2}
                label="Recebido acumulado"
                value={money(financeReceived)}
              />
              <Stat
                icon={AlertCircle}
                label="Saldo a receber"
                value={money(financeBalance)}
              />
              <Stat
                icon={Clock3}
                label="OS com entrega atrasada e saldo"
                value={lateOrders.length}
              />
            </section>

            <section className="stats finance-secondary-stats">
              <Stat
                icon={ClipboardList}
                label="Valor das OS criadas neste mês"
                value={money(monthOrdersValue)}
              />
              <Stat
                icon={Users}
                label="Clientes com valores pendentes"
                value={new Set(receivables.map(order => order.client_id).filter(Boolean)).size}
              />
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>Recebimentos por período</h3>
                  <p className="muted">
                    Consulte os pagamentos lançados no histórico.
                  </p>
                </div>
                <span className="finance-count">
                  {periodPaymentCount} lançamentos
                </span>
              </div>

              <div className="form-grid finance-filters">
                <label>
                  Data inicial
                  <input
                    type="date"
                    value={financeFrom}
                    onChange={e => setFinanceFrom(e.target.value)}
                  />
                </label>
                <label>
                  Data final
                  <input
                    type="date"
                    value={financeTo}
                    onChange={e => setFinanceTo(e.target.value)}
                  />
                </label>
              </div>

              <div className="payment-period-total">
                <span>Total recebido no período</span>
                <strong>{money(periodReceived)}</strong>
              </div>

              <div className="table-wrap">
                <table className="finance-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>OS</th>
                      <th>Valor</th>
                      <th>Forma de pagamento</th>
                      <th>Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodPayments.map(payment => {
                      const order = orders.find(
                        item => item.id === payment.work_order_id
                      )

                      return (
                        <tr key={payment.id}>
                          <td>{dateBR(payment.paid_at)}</td>
                          <td>
                            <b>
                              #{String(order?.number || '—').padStart(5, '0')}
                            </b>
                          </td>
                          <td><strong>{money(payment.amount)}</strong></td>
                          <td>{payment.payment_method}</td>
                          <td>{payment.notes || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {!periodPayments.length && (
                  <Empty text="Nenhum recebimento registrado neste período." />
                )}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>Contas a receber</h3>
                  <p className="muted">
                    Ordens com saldo pendente, organizadas pela data de entrega prevista.
                  </p>
                </div>
                <span className="finance-count">{receivables.length} OS</span>
              </div>

              <div className="table-wrap">
                <table className="finance-table">
                  <thead>
                    <tr>
                      <th>OS</th>
                      <th>Cliente</th>
                      <th>Entrega prevista</th>
                      <th>Valor total</th>
                      <th>Recebido</th>
                      <th>Saldo</th>
                      <th>Situação</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivables.map(order => {
                      const overdue = Boolean(
                        order.due_date && order.due_date < today
                      )

                      return (
                        <tr key={order.id}>
                          <td>
                            <b>#{String(order.number).padStart(5, '0')}</b>
                          </td>
                          <td>{order.clients?.name || 'Cliente não informado'}</td>
                          <td>{dateBR(order.due_date)}</td>
                          <td>{money(order.total)}</td>
                          <td>{money(order.receivedValue)}</td>
                          <td>
                            <strong className="finance-balance">
                              {money(order.balanceValue)}
                            </strong>
                          </td>
                          <td>
                            <span className={`finance-status ${overdue ? 'overdue' : ''}`}>
                              {overdue
                                ? 'Entrega atrasada'
                                : order.payment_status === 'Parcial'
                                  ? 'Parcial'
                                  : 'Pendente'}
                            </span>
                          </td>
                          <td>
                            <button
                              className="secondary small"
                              onClick={() => openPayments(order)}
                            >
                              Recebimentos
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {!receivables.length && (
                  <Empty text="Não há valores pendentes para receber." />
                )}
              </div>
            </section>

            <section className="finance-note">
              <AlertCircle size={17} />
              <div>
                <b>Sobre os dados financeiros</b>
                <p>
                  O recebido acumulado inclui os valores anteriores à implantação
                  do histórico. Esses valores antigos foram preservados, mas não
                  aparecem como lançamentos datados. O relatório por período
                  considera os novos pagamentos registrados individualmente.
                  A data de entrega da OS não representa vencimento financeiro.
                </p>
              </div>
            </section>
          </>
        )}

        {page === 'costs' && (
          <>
            <section className="welcome"><div><p className="eyebrow">CUSTOS E LUCRATIVIDADE</p><h1>Custos por OS</h1><p>Registre os custos diretos e acompanhe o resultado de cada pedido.</p></div></section>
            <section className="stats finance-stats">
              <Stat icon={CircleDollarSign} label="Valor vendido (OS ativas)" value={money(totalRevenue)} />
              <Stat icon={Receipt} label="Custos diretos registrados" value={money(totalOrderCosts)} />
              <Stat icon={TrendingUp} label="Lucro bruto estimado" value={money(totalRevenue - totalOrderCosts)} />
              <Stat icon={CheckCircle2} label="Margem bruta geral" value={`${totalRevenue > 0 ? ((totalRevenue-totalOrderCosts)/totalRevenue*100).toFixed(1).replace('.', ',') : '0,0'}%`} />
            </section>
            <section className="panel">
              <div className="panel-head"><div><h3>Novo custo de produção</h3><p className="muted">Ex.: camisetas prontas, telas/insumos, DTF ou sublimação terceirizados, mão de obra e extras.</p></div></div>
              <form className="form-grid" onSubmit={saveOrderCost}>
                <label>Ordem de serviço *<select required value={costForm.work_order_id} onChange={e=>setCostForm({...costForm,work_order_id:e.target.value})}><option value="">Selecione a OS</option>{orders.filter(o=>o.status!=='Cancelada').map(o=><option key={o.id} value={o.id}>#{String(o.number).padStart(5,'0')} · {o.clients?.name || 'Sem cliente'}</option>)}</select></label>
                <label>Categoria<select value={costForm.category} onChange={e=>setCostForm({...costForm,category:e.target.value})}>{['Camisetas prontas','Telas e insumos de serigrafia','DTF terceirizado','Sublimação terceirizada','Mão de obra','Frete','Outros'].map(x=><option key={x}>{x}</option>)}</select></label>
                <label className="wide">Descrição *<input required value={costForm.description} onChange={e=>setCostForm({...costForm,description:e.target.value})} placeholder="Ex.: 30 camisetas pretas tamanho variado" /></label>
                <label>Quantidade<input type="number" min="0.001" step="0.001" required value={costForm.quantity} onChange={e=>setCostForm({...costForm,quantity:e.target.value})}/></label>
                <label>Custo unitário (R$)<input type="number" min="0" step="0.01" required value={costForm.unit_cost} onChange={e=>setCostForm({...costForm,unit_cost:e.target.value})} placeholder="0,00"/></label>
                <label>Data do custo<input type="date" value={costForm.cost_date} onChange={e=>setCostForm({...costForm,cost_date:e.target.value})}/></label>
                <label>Observações<input value={costForm.notes} onChange={e=>setCostForm({...costForm,notes:e.target.value})}/></label>
                <div className="form-actions wide"><button className="primary" disabled={busy}><Plus size={16}/> Registrar custo · {money(Number(costForm.quantity||0)*Number(costForm.unit_cost||0))}</button></div>
              </form>
            </section>
            <section className="panel"><div className="panel-head"><div><h3>Lucratividade por ordem</h3><p className="muted">O lucro é calculado com os custos diretos já lançados. OS sem custos cadastrados aparecem com custo zero.</p></div></div>
              <div className="table-wrap"><table className="finance-table"><thead><tr><th>OS</th><th>Cliente</th><th>Valor vendido</th><th>Custo direto</th><th>Lucro bruto</th><th>Margem</th></tr></thead><tbody>{profitOrders.map(o=><tr key={o.id}><td><b>#{String(o.number).padStart(5,'0')}</b></td><td>{o.clients?.name || '—'}</td><td>{money(o.total)}</td><td>{money(o.costTotal)}</td><td><strong className={o.profit<0?'finance-balance':''}>{money(o.profit)}</strong></td><td>{o.margin.toFixed(1).replace('.',',')}%</td></tr>)}</tbody></table>{!profitOrders.length&&<Empty text="Ainda não existem OS para calcular."/>}</div>
            </section>
            <section className="panel"><div className="panel-head"><div><h3>Últimos custos lançados</h3><p className="muted">Custos vinculados às ordens de serviço.</p></div></div><div className="table-wrap"><table className="finance-table"><thead><tr><th>Data</th><th>OS</th><th>Categoria</th><th>Descrição</th><th>Qtd.</th><th>Unitário</th><th>Total</th><th></th></tr></thead><tbody>{orderCosts.map(c=>{const o=orders.find(x=>x.id===c.work_order_id);return <tr key={c.id}><td>{dateBR(c.cost_date)}</td><td>#{String(o?.number||'—').padStart(5,'0')}</td><td>{c.category}</td><td>{c.description}</td><td>{c.quantity}</td><td>{money(c.unit_cost)}</td><td><b>{money(c.total_cost)}</b></td><td><button className="remove-btn" onClick={()=>deleteOrderCost(c)}>Excluir</button></td></tr>})}</tbody></table>{!orderCosts.length&&<Empty text="Nenhum custo registrado ainda."/>}</div></section>
          </>
        )}

        {page === 'expenses' && (
          <>
            <section className="welcome"><div><p className="eyebrow">DESPESAS GERAIS</p><h1>Despesas da confecção</h1><p>Registre gastos que não pertencem exclusivamente a uma OS.</p></div></section>
            <section className="stats finance-stats"><Stat icon={Receipt} label="Despesas cadastradas" value={money(totalGeneralExpenses)}/><Stat icon={TrendingUp} label="Resultado após custos e despesas" value={money(totalOperatingResult)}/><Stat icon={CalendarDays} label="Despesas no período filtrado" value={money(periodExpenseTotal)}/><Stat icon={CircleDollarSign} label="Custos diretos no período" value={money(periodOrderCosts)}/><Stat icon={TrendingUp} label="Resultado de caixa no período*" value={money(periodOperatingResult)}/></section>
            <section className="panel"><div className="panel-head"><div><h3>Nova despesa</h3><p className="muted">Ex.: energia, aluguel, internet, manutenção, material administrativo e outros.</p></div></div>
              <form className="form-grid" onSubmit={saveExpense}>
                <label>Categoria<select value={expenseForm.category} onChange={e=>setExpenseForm({...expenseForm,category:e.target.value})}>{['Energia','Aluguel','Água','Internet e telefone','Manutenção','Material de consumo','Transporte','Impostos e taxas','Marketing','Outros'].map(x=><option key={x}>{x}</option>)}</select></label>
                <label>Data<input type="date" value={expenseForm.expense_date} onChange={e=>setExpenseForm({...expenseForm,expense_date:e.target.value})}/></label>
                <label className="wide">Descrição *<input required value={expenseForm.description} onChange={e=>setExpenseForm({...expenseForm,description:e.target.value})} placeholder="Descreva a despesa"/></label>
                <label>Valor (R$) *<input type="number" required min="0.01" step="0.01" value={expenseForm.amount} onChange={e=>setExpenseForm({...expenseForm,amount:e.target.value})} placeholder="0,00"/></label>
                <label>Forma de pagamento<select value={expenseForm.payment_method} onChange={e=>setExpenseForm({...expenseForm,payment_method:e.target.value})}>{['Pix','Dinheiro','Cartão de débito','Cartão de crédito','Transferência','Boleto','Outro'].map(x=><option key={x}>{x}</option>)}</select></label>
                <label className="wide">Observações<input value={expenseForm.notes} onChange={e=>setExpenseForm({...expenseForm,notes:e.target.value})}/></label>
                <div className="form-actions wide"><button className="primary" disabled={busy}><Plus size={16}/> Registrar despesa</button></div>
              </form>
            </section>
            <section className="panel"><div className="panel-head"><div><h3>Histórico de despesas</h3><p className="muted">Filtre pelo mesmo período do financeiro.</p></div></div><div className="form-grid finance-filters"><label>Data inicial<input type="date" value={financeFrom} onChange={e=>setFinanceFrom(e.target.value)}/></label><label>Data final<input type="date" value={financeTo} onChange={e=>setFinanceTo(e.target.value)}/></label></div><div className="payment-period-total"><span>Total de despesas no período</span><strong>{money(periodExpenseTotal)}</strong></div><p className="muted">*Resultado estimado de caixa: recebimentos lançados no histórico menos custos e despesas cadastrados no período. Não inclui recebimentos antigos sem data individual.</p><div className="table-wrap"><table className="finance-table"><thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Pagamento</th><th>Valor</th><th></th></tr></thead><tbody>{periodExpenses.map(x=><tr key={x.id}><td>{dateBR(x.expense_date)}</td><td>{x.category}</td><td>{x.description}</td><td>{x.payment_method}</td><td><b>{money(x.amount)}</b></td><td><button className="remove-btn" onClick={()=>deleteExpense(x)}>Excluir</button></td></tr>)}</tbody></table>{!periodExpenses.length&&<Empty text="Nenhuma despesa neste período."/>}</div></section>
          </>
        )}

        {page === 'reports' && (
          <>
            <section className="welcome"><div><p className="eyebrow">INDICADORES GERENCIAIS</p><h1>Relatórios</h1><p>Visão consolidada de vendas, recebimentos, custos diretos e despesas.</p></div><button className="primary report-print-button" type="button" onClick={()=>window.print()}><Printer size={16}/> Imprimir relatório</button></section>
            <section className="panel"><div className="panel-head"><div><h3>Período analisado</h3><p className="muted">As vendas usam a data de criação da OS; recebimentos, a data do pagamento; custos e despesas, suas respectivas datas.</p></div></div><div className="form-grid finance-filters"><label>Data inicial<input type="date" value={financeFrom} onChange={e=>setFinanceFrom(e.target.value)}/></label><label>Data final<input type="date" value={financeTo} onChange={e=>setFinanceTo(e.target.value)}/></label></div></section>
            <section className="stats finance-stats"><Stat icon={ClipboardList} label="OS criadas no período" value={periodOrders.length}/><Stat icon={Package} label="Peças nas OS do período" value={periodPieces.toLocaleString('pt-BR')}/><Stat icon={CircleDollarSign} label="Valor vendido no período" value={money(periodOrderRevenue)}/><Stat icon={Wallet} label="Recebido no período" value={money(periodReceived)}/><Stat icon={Receipt} label="Custos diretos + despesas" value={money(periodOrderCosts+periodExpenseTotal)}/><Stat icon={TrendingUp} label="Resultado de caixa estimado" value={money(periodOperatingResult)}/></section>
            <section className="panel report-breakdown-grid">
              <div>
                <div className="panel-head"><div><h3>OS por situação</h3><p className="muted">Distribuição das ordens criadas no período selecionado.</p></div></div>
                {reportStatusCounts.length ? reportStatusCounts.map(item => <div className="report-status-row" key={item.status}><span>{item.status}</span><strong>{item.count}</strong></div>) : <Empty text="Nenhuma OS no período." />}
              </div>
              <div>
                <div className="panel-head"><div><h3>Clientes em destaque</h3><p className="muted">Classificação por valor contratado no período.</p></div></div>
                {reportTopClients.length ? <div className="table-wrap"><table className="finance-table"><thead><tr><th>Cliente</th><th>OS</th><th>Peças</th><th>Vendido</th></tr></thead><tbody>{reportTopClients.map(client => <tr key={client.name}><td><b>{client.name}</b></td><td>{client.orders}</td><td>{client.pieces.toLocaleString('pt-BR')}</td><td>{money(client.revenue)}</td></tr>)}</tbody></table></div> : <Empty text="Nenhum cliente no período." />}
              </div>
            </section>
            <section className="panel"><div className="panel-head"><div><h3>Resumo mensal — últimos 6 meses</h3><p className="muted">Valores de recebimento e gastos datados. Vendas consideram OS criadas no mês.</p></div></div><div className="table-wrap"><table className="finance-table"><thead><tr><th>Mês</th><th>Vendido</th><th>Recebido</th><th>Custos diretos</th><th>Despesas gerais</th><th>Resultado de caixa*</th></tr></thead><tbody>{reportMonths.map(month=><tr key={month.key}><td><b>{month.label}</b></td><td>{money(month.revenue)}</td><td>{money(month.received)}</td><td>{money(month.costs)}</td><td>{money(month.general)}</td><td><strong className={month.result<0?'finance-balance':''}>{money(month.result)}</strong></td></tr>)}</tbody></table></div><p className="muted">*Resultado estimado: recebimentos registrados individualmente menos custos diretos e despesas lançados no mesmo mês. Não inclui recebimentos antigos sem data individual.</p></section>
            <section className="panel"><div className="panel-head"><div><h3>OS com melhor resultado bruto</h3><p className="muted">Cálculo por OS: valor vendido menos custos diretos registrados. Despesas gerais não são rateadas entre pedidos.</p></div></div><div className="table-wrap"><table className="finance-table"><thead><tr><th>OS</th><th>Cliente</th><th>Venda</th><th>Custo direto</th><th>Lucro bruto</th><th>Margem</th></tr></thead><tbody>{[...profitOrders].sort((a,b)=>b.profit-a.profit).slice(0,10).map(order=><tr key={order.id}><td>#{String(order.number).padStart(5,'0')}</td><td>{order.clients?.name||'—'}</td><td>{money(order.total)}</td><td>{money(order.costTotal)}</td><td>{money(order.profit)}</td><td>{order.margin.toFixed(1).replace('.',',')}%</td></tr>)}</tbody></table>{!profitOrders.length&&<Empty text="Ainda não há dados para este relatório."/>}</div></section>
          </>
        )}

        {page === 'clients' && (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>Clientes</h3>
                <p className="muted">Cadastro e consulta de clientes.</p>
              </div>
              <button className="primary" onClick={() => openClient()}>
                <Plus size={17} />
                Novo cliente
              </button>
            </div>

            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Buscar cliente"
            />

            <div className="data-list">
              {filteredClients.map(client => (
                <div className="data-row" key={client.id}>
                  <div className="row-avatar"><Users size={18} /></div>
                  <div className="grow">
                    <b>{client.name}</b>
                    <small>
                      {client.phone || client.whatsapp || 'Sem telefone'}
                      {' · '}
                      {client.email || 'Sem e-mail'}
                    </small>
                  </div>
                  <button className="secondary small" onClick={() => setProfileClient(client)}><History size={13}/> Histórico</button>
                  <button
                    className="secondary small"
                    onClick={() => openClient(client)}
                  >
                    Editar
                  </button>
                </div>
              ))}
            </div>

            {!filteredClients.length && (
              <Empty text="Nenhum cliente cadastrado ainda." />
            )}
          </section>
        )}

        {page === 'products' && (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>Produtos</h3>
                <p className="muted">Catálogo de produtos e serviços.</p>
              </div>
              <button className="primary" onClick={() => openProduct()}>
                <Plus size={17} />
                Novo produto
              </button>
            </div>

            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Buscar produto"
            />

            <div className="data-list">
              {filteredProducts.map(product => (
                <div className="data-row" key={product.id}>
                  <div className="row-avatar"><Package size={18} /></div>
                  <div className="grow">
                    <b>{product.name}</b>
                    <small>
                      {product.category || 'Sem categoria'}
                      {' · '}
                      {money(product.base_price)}
                    </small>
                  </div>
                  <button
                    className="secondary small"
                    onClick={() => openProduct(product)}
                  >
                    Editar
                  </button>
                </div>
              ))}
            </div>

            {!filteredProducts.length && (
              <Empty text="Nenhum produto cadastrado ainda." />
            )}
          </section>
        )}

        <footer>DCS CONFECÇÃO Gestão <span>·</span> Versão 1.4</footer>
      </main>

      {profileClient && (
        <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setProfileClient(null)}}>
          <div className="modal crm-profile-modal"><div className="modal-head"><div><p className="eyebrow">RELACIONAMENTO COM CLIENTE</p><h3>{profileClient.name}</h3></div><button className="icon-btn" onClick={()=>setProfileClient(null)}><X/></button></div>
            {(() => { const history = orders.filter(o=>o.client_id===profileClient.id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)); const total=history.reduce((sum,o)=>sum+Number(o.total||0),0); const bought=history.filter(o=>['Aprovada','Em produção','Concluída','Entregue'].includes(o.status)).length; return <>
              <div className="crm-summary"><div><small>Pedidos</small><b>{history.length}</b></div><div><small>Pedidos aprovados</small><b>{bought}</b></div><div><small>Valor contratado</small><b>{money(total)}</b></div></div>
              <h4>Histórico de pedidos</h4>{history.length ? <div className="table-wrap"><table><thead><tr><th>OS</th><th>Data</th><th>Status</th><th>Valor</th><th>Ação</th></tr></thead><tbody>{history.map(o=><tr key={o.id}><td>#{String(o.number).padStart(5,'0')}</td><td>{dateBR(o.created_at?.slice(0,10))}</td><td>{o.status}</td><td>{money(o.total)}</td><td><button className="secondary small" onClick={()=>{setProfileClient(null);editOrder(o)}}>Abrir</button></td></tr>)}</tbody></table></div> : <Empty text="Este cliente ainda não possui pedidos."/>}
              <div className="form-actions"><button className="secondary" onClick={()=>{setProfileClient(null);openClient(profileClient)}}>Editar cadastro</button><button className="primary" onClick={()=>{setProfileClient(null);openOrder();setOrderForm(f=>({...f,client_id:profileClient.id}))}}>Novo orçamento / OS</button></div>
            </> })()}
          </div>
        </div>
      )}

      {selectedQuote && (
        <div className="quote-print-sheet">
          <div className="print-controls"><button className="secondary" onClick={()=>window.print()}><Printer size={15}/> Imprimir / salvar PDF</button><button className="secondary" onClick={()=>setSelectedQuote(null)}>Fechar</button></div>
          <div className="quote-document"><header><div className="brand-mark">D</div><div><h1>DCS CONFECÇÃO</h1><p>ORÇAMENTO DE CONFECÇÃO</p></div><strong>#{String(selectedQuote.number).padStart(5,'0')}</strong></header>
            <div className="quote-client"><b>Cliente: </b>{selectedQuote.clients?.name || '—'}<br/><b>Contato: </b>{selectedQuote.clients?.phone || selectedQuote.clients?.whatsapp || '—'}<br/><b>Data: </b>{dateBR(selectedQuote.created_at?.slice(0,10))}<br/><b>Previsão: </b>{dateBR(selectedQuote.due_date)}</div>
            <table><thead><tr><th>Descrição</th><th>Qtd.</th><th>Valor unit.</th><th>Total</th></tr></thead><tbody>{(selectedQuote.work_order_items||[]).map((it,i)=><tr key={i}><td>{it.description}</td><td>{getItemQuantity(it)}</td><td>{money(it.unit_price)}</td><td>{money(getItemQuantity(it)*Number(it.unit_price))}</td></tr>)}</tbody></table>
            <div className="quote-total">Total do orçamento: <b>{money(selectedQuote.total)}</b></div><p className="quote-terms">Este orçamento está sujeito à aprovação do cliente. O prazo de produção começa após a aprovação e confirmação das condições combinadas.</p><div className="quote-sign">DCS CONFECÇÃO · Obrigado pela preferência!</div>
          </div>
        </div>
      )}

      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setModal('')
          }}
        >
          <div className="modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">DCS CONFECÇÃO GESTÃO</p>
                <h3>
                  {modal === 'client'
                    ? (editing ? 'Editar cliente' : 'Novo cliente')
                    : modal === 'product'
                      ? (editing ? 'Editar produto' : 'Novo produto')
                      : modal === 'payment'
                        ? `Recebimentos da OS #${String(paymentOrder?.number || '').padStart(5, '0')}`
                        : (editing
                            ? `Editar OS #${String(editing.number).padStart(5, '0')}`
                            : 'Nova ordem de serviço')}
                </h3>
              </div>
              <button className="icon-btn" onClick={() => setModal('')}>
                <X />
              </button>
            </div>

            {modal === 'client' && (
              <form onSubmit={saveClient} className="form-grid">
                <label className="wide">
                  Nome / Razão social *
                  <input
                    required
                    value={clientForm.name}
                    onChange={e => setClientForm({
                      ...clientForm,
                      name: e.target.value
                    })}
                  />
                </label>

                <label>
                  Telefone
                  <input
                    value={clientForm.phone || ''}
                    onChange={e => setClientForm({
                      ...clientForm,
                      phone: e.target.value
                    })}
                  />
                </label>

                <label>
                  WhatsApp
                  <input
                    value={clientForm.whatsapp || ''}
                    onChange={e => setClientForm({
                      ...clientForm,
                      whatsapp: e.target.value
                    })}
                  />
                </label>

                <label>
                  CPF / CNPJ
                  <input
                    value={clientForm.document || ''}
                    onChange={e => setClientForm({
                      ...clientForm,
                      document: e.target.value
                    })}
                  />
                </label>

                <label>
                  E-mail
                  <input
                    type="email"
                    value={clientForm.email || ''}
                    onChange={e => setClientForm({
                      ...clientForm,
                      email: e.target.value
                    })}
                  />
                </label>

                <label className="wide">
                  Endereço
                  <input
                    value={clientForm.address || ''}
                    onChange={e => setClientForm({
                      ...clientForm,
                      address: e.target.value
                    })}
                  />
                </label>

                <label className="wide">
                  Observações
                  <textarea
                    value={clientForm.notes || ''}
                    onChange={e => setClientForm({
                      ...clientForm,
                      notes: e.target.value
                    })}
                  />
                </label>

                <div className="form-actions wide">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setModal('')}
                  >
                    Cancelar
                  </button>
                  <button className="primary" disabled={busy}>
                    Salvar cliente
                  </button>
                </div>
              </form>
            )}

            {modal === 'product' && (
              <form onSubmit={saveProduct} className="form-grid">
                <label className="wide">
                  Nome do produto *
                  <input
                    required
                    value={productForm.name}
                    onChange={e => setProductForm({
                      ...productForm,
                      name: e.target.value
                    })}
                    placeholder="Ex.: Camiseta básica"
                  />
                </label>

                <label>
                  Categoria
                  <input
                    value={productForm.category || ''}
                    onChange={e => setProductForm({
                      ...productForm,
                      category: e.target.value
                    })}
                  />
                </label>

                <label>
                  Preço base (R$)
                  <input
                    type="number"
                    min="0"
                    step=".01"
                    value={productForm.base_price}
                    onChange={e => setProductForm({
                      ...productForm,
                      base_price: e.target.value
                    })}
                  />
                </label>

                <label className="wide">
                  Descrição
                  <textarea
                    value={productForm.description || ''}
                    onChange={e => setProductForm({
                      ...productForm,
                      description: e.target.value
                    })}
                  />
                </label>

                <div className="form-actions wide">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setModal('')}
                  >
                    Cancelar
                  </button>
                  <button className="primary" disabled={busy}>
                    Salvar produto
                  </button>
                </div>
              </form>
            )}

            {modal === 'payment' && paymentOrder && (
              <div className="payment-modal-content">
                <div className="payment-summary">
                  <div>
                    <span>Valor total da OS</span>
                    <strong>{money(paymentOrder.total)}</strong>
                  </div>
                  <div>
                    <span>Total recebido</span>
                    <strong>{money(paymentOrder.amount_paid)}</strong>
                  </div>
                  <div>
                    <span>Saldo restante</span>
                    <strong>
                      {money(Math.max(
                        0,
                        Number(paymentOrder.total || 0) -
                        Number(paymentOrder.amount_paid || 0)
                      ))}
                    </strong>
                  </div>
                  <div>
                    <span>Situação</span>
                    <strong>{paymentOrder.payment_status || 'Pendente'}</strong>
                  </div>
                </div>

                {Number(paymentOrder.opening_amount_received || 0) > 0 && (
                  <div className="finance-note">
                    <AlertCircle size={17} />
                    <div>
                      <b>Recebimentos anteriores ao histórico</b>
                      <p>
                        {money(paymentOrder.opening_amount_received)} já estavam
                        registrados antes da implantação do histórico individual.
                        Esse valor foi preservado, mas não possui lançamentos com
                        datas e formas de pagamento.
                      </p>
                    </div>
                  </div>
                )}

                <h4>Registrar novo recebimento</h4>

                {Number(paymentOrder.total) - Number(paymentOrder.amount_paid) > 0.005 ? (
                  <form onSubmit={registerPayment} className="form-grid">
                    <label>
                      Valor recebido (R$) *
                      <input
                        type="number"
                        required
                        min="0.01"
                        max={Math.max(
                          0,
                          Number(paymentOrder.total) -
                          Number(paymentOrder.amount_paid)
                        )}
                        step="0.01"
                        value={paymentForm.amount}
                        onChange={e => setPaymentForm({
                          ...paymentForm,
                          amount: e.target.value
                        })}
                        placeholder="0,00"
                      />
                    </label>

                    <label>
                      Data do recebimento *
                      <input
                        type="date"
                        required
                        value={paymentForm.paid_at}
                        onChange={e => setPaymentForm({
                          ...paymentForm,
                          paid_at: e.target.value
                        })}
                      />
                    </label>

                    <label>
                      Forma de pagamento *
                      <select
                        value={paymentForm.payment_method}
                        onChange={e => setPaymentForm({
                          ...paymentForm,
                          payment_method: e.target.value
                        })}
                      >
                        {[
                          'Pix',
                          'Dinheiro',
                          'Transferência',
                          'Cartão de débito',
                          'Cartão de crédito',
                          'Boleto',
                          'Outro'
                        ].map(method => (
                          <option key={method}>{method}</option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Observação
                      <input
                        value={paymentForm.notes}
                        onChange={e => setPaymentForm({
                          ...paymentForm,
                          notes: e.target.value
                        })}
                        placeholder="Ex.: entrada do pedido"
                      />
                    </label>

                    <div className="form-actions wide">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setModal('')}
                      >
                        Fechar
                      </button>
                      <button className="primary" disabled={busy}>
                        {busy ? 'Registrando...' : 'Registrar recebimento'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="notice">
                    Esta OS já está totalmente paga.
                  </div>
                )}

                <div className="payment-history">
                  <div className="panel-head">
                    <div>
                      <h3>Histórico de pagamentos</h3>
                      <p className="muted">
                        Lançamentos registrados individualmente nesta OS.
                      </p>
                    </div>
                    <span className="finance-count">
                      {(paymentOrder.payments || []).length} registros
                    </span>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Valor</th>
                          <th>Forma</th>
                          <th>Observação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(paymentOrder.payments || []).map(payment => (
                          <tr key={payment.id}>
                            <td>{dateBR(payment.paid_at)}</td>
                            <td><strong>{money(payment.amount)}</strong></td>
                            <td>{payment.payment_method}</td>
                            <td>{payment.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {!(paymentOrder.payments || []).length && (
                      <Empty text="Ainda não existem pagamentos individuais nesta OS." />
                    )}
                  </div>
                </div>
              </div>
            )}

            {modal === 'order' && (
              <form onSubmit={saveOrder} className="form-grid">
                <label className="wide">
                  Cliente
                  <select
                    value={orderForm.client_id}
                    onChange={e => setOrderForm({
                      ...orderForm,
                      client_id: e.target.value
                    })}
                  >
                    <option value="">Selecione (opcional)</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Status
                  <select
                    value={orderForm.status}
                    onChange={e => setOrderForm({
                      ...orderForm,
                      status: e.target.value
                    })}
                  >
                    {[
                      'Orçamento',
                      'Aguardando aprovação',
                      'Aprovada',
                      'Em produção',
                      'Concluída',
                      'Entregue',
                      'Cancelada'
                    ].map(status => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Entrega prevista
                  <input
                    type="date"
                    value={orderForm.due_date}
                    onChange={e => setOrderForm({
                      ...orderForm,
                      due_date: e.target.value
                    })}
                  />
                </label>

                <div className="wide item-editor">
                  <div className="item-title">
                    <b>Itens da OS</b>
                    <button
                      type="button"
                      className="text-btn"
                      onClick={() => setOrderForm({
                        ...orderForm,
                        items: [
                          ...orderForm.items,
                          {
                            product_id: '',
                            description: '',
                            quantity: 0,
                            unit_price: 0,
                            size_breakdown: {},
                            legacyQuantity: false
                          }
                        ]
                      })}
                    >
                      <Plus size={15} />
                      Adicionar item
                    </button>
                  </div>

                  {orderForm.items.map((item, index) => (
                    <div className="item-fields" key={index}>
                      <label className="wide">
                        Produto / descrição
                        <select
                          value={item.product_id}
                          onChange={e => {
                            const product = products.find(
                              p => p.id === e.target.value
                            )

                            const updated = [...orderForm.items]
                            updated[index] = {
                              ...updated[index],
                              product_id: e.target.value,
                              description: product?.name || '',
                              unit_price: product?.base_price || 0
                            }

                            setOrderForm({
                              ...orderForm,
                              items: updated
                            })
                          }}
                        >
                          <option value="">Escolha do catálogo ou preencha abaixo</option>
                          {products.map(product => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </select>

                        <input
                          placeholder="Descrição do item"
                          value={item.description}
                          onChange={e => {
                            const updated = [...orderForm.items]
                            updated[index].description = e.target.value
                            setOrderForm({
                              ...orderForm,
                              items: updated
                            })
                          }}
                        />
                      </label>

                      <div className="size-grid-editor wide">
                        <div className="size-grid-heading">
                          <b>Grade de tamanhos</b>
                          <strong>{getSizeTotal(item.size_breakdown) || (item.legacyQuantity ? Number(item.quantity) || 0 : 0)} peças</strong>
                        </div>
                        <div className="size-grid-fields">
                          {sizeKeys.map(size => (
                            <label key={size}>
                              {size}
                              <input
                                type="number"
                                min="0"
                                step="1"
                                inputMode="numeric"
                                placeholder="0"
                                value={item.size_breakdown?.[size] ?? ''}
                                onChange={e => {
                                  const raw = e.target.value
                                  const updated = [...orderForm.items]
                                  updated[index] = {
                                    ...updated[index],
                                    size_breakdown: {
                                      ...(updated[index].size_breakdown || {}),
                                      [size]: raw === '' ? '' : Math.max(0, Math.floor(Number(raw) || 0))
                                    },
                                    legacyQuantity: false
                                  }
                                  setOrderForm({ ...orderForm, items: updated })
                                }}
                              />
                            </label>
                          ))}
                        </div>
                        {item.legacyQuantity && !getSizeTotal(item.size_breakdown) && (
                          <small className="legacy-size-note">Item antigo sem grade registrada. A quantidade já salva será preservada até você informar os tamanhos.</small>
                        )}
                      </div>

                      <label>
                        Valor unitário
                        <input
                          type="number"
                          min="0"
                          step=".01"
                          value={item.unit_price}
                          onChange={e => {
                            const updated = [...orderForm.items]
                            updated[index].unit_price = e.target.value
                            setOrderForm({
                              ...orderForm,
                              items: updated
                            })
                          }}
                        />
                      </label>

                      {orderForm.items.length > 1 && (
                        <button
                          type="button"
                          className="remove-btn"
                          onClick={() => setOrderForm({
                            ...orderForm,
                            items: orderForm.items.filter(
                              (_, itemIndex) => itemIndex !== index
                            )
                          })}
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="wide production-editor">
                  <h4>Ficha de produção</h4>

                  <div className="form-grid">
                    <label>
                      Tecido
                      <input
                        value={orderForm.production.fabric}
                        onChange={e => setOrderForm({
                          ...orderForm,
                          production: {
                            ...orderForm.production,
                            fabric: e.target.value
                          }
                        })}
                      />
                    </label>

                    <label>
                      Técnica de estampa
                      <select
                        value={orderForm.production.printTechnique}
                        onChange={e => setOrderForm({
                          ...orderForm,
                          production: {
                            ...orderForm.production,
                            printTechnique: e.target.value
                          }
                        })}
                      >
                        {[
                          'Serigrafia base d’água',
                          'DTF',
                          'Sublimação',
                          'Plastisol',
                          'Outra'
                        ].map(method => (
                          <option key={method}>{method}</option>
                        ))}
                      </select>
                    </label>

                    <label className="wide">
                      Quantidade por cor
                      <input
                        value={orderForm.production.colorBreakdown}
                        onChange={e => setOrderForm({
                          ...orderForm,
                          production: {
                            ...orderForm.production,
                            colorBreakdown: e.target.value
                          }
                        })}
                        placeholder="Ex.: preta 20, branca 10"
                      />
                    </label>

                    <label>
                      Cores da estampa
                      <input
                        value={orderForm.production.printColors}
                        onChange={e => setOrderForm({
                          ...orderForm,
                          production: {
                            ...orderForm.production,
                            printColors: e.target.value
                          }
                        })}
                      />
                    </label>

                    <label>
                      Frente
                      <input
                        value={orderForm.production.front}
                        onChange={e => setOrderForm({
                          ...orderForm,
                          production: {
                            ...orderForm.production,
                            front: e.target.value
                          }
                        })}
                        placeholder="Descrição / medidas"
                      />
                    </label>

                    <label>
                      Costas
                      <input
                        value={orderForm.production.back}
                        onChange={e => setOrderForm({
                          ...orderForm,
                          production: {
                            ...orderForm.production,
                            back: e.target.value
                          }
                        })}
                        placeholder="Descrição / medidas"
                      />
                    </label>

                    <label>
                      Mangas
                      <input
                        value={orderForm.production.sleeves}
                        onChange={e => setOrderForm({
                          ...orderForm,
                          production: {
                            ...orderForm.production,
                            sleeves: e.target.value
                          }
                        })}
                        placeholder="Descrição / medidas"
                      />
                    </label>

                    <label className="wide">
                      Instruções para produção
                      <textarea
                        value={orderForm.production.instructions}
                        onChange={e => setOrderForm({
                          ...orderForm,
                          production: {
                            ...orderForm.production,
                            instructions: e.target.value
                          }
                        })}
                      />
                    </label>
                  </div>
                </div>

                <div className="wide upload-box">
                  <label className="wide">
                    Imagem de referência / mockup (JPG, PNG ou WEBP)
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={e => setOrderForm({
                        ...orderForm,
                        mockupFile: e.target.files?.[0] || null,
                        removeMockup: false
                      })}
                    />
                  </label>

                  {editing?.mockupSignedUrl &&
                    !orderForm.removeMockup &&
                    !orderForm.mockupFile && (
                      <div className="file-picked">
                        <Eye size={18} />
                        <span>Mockup atual anexado</span>
                        <button
                          type="button"
                          className="text-btn"
                          onClick={() => setOrderForm({
                            ...orderForm,
                            removeMockup: true
                          })}
                        >
                          Remover imagem atual
                        </button>
                      </div>
                    )}

                  {orderForm.mockupFile && (
                    <div className="file-picked">
                      <ImagePlus size={18} />
                      <span>{orderForm.mockupFile.name}</span>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => setOrderForm({
                          ...orderForm,
                          mockupFile: null
                        })}
                      >
                        Cancelar novo arquivo
                      </button>
                    </div>
                  )}
                </div>

                <div className="payment-editor wide">
                  <div className="payment-values">
                    <div>
                      <span>Valor total da OS</span>
                      <strong>
                        {money(getOrderItemsTotal(orderForm.items))}
                      </strong>
                    </div>

                    {editing && (
                      <>
                        <div>
                          <span>Já recebido</span>
                          <strong>{money(editing.amount_paid)}</strong>
                        </div>
                        <div>
                          <span>Saldo após salvar</span>
                          <strong>
                            {money(Math.max(
                              0,
                              getOrderItemsTotal(orderForm.items) - Number(editing.amount_paid || 0)
                            ))}
                          </strong>
                        </div>
                      </>
                    )}
                  </div>

                  <p className="muted">
                    Os pagamentos são registrados separadamente pelo botão
                    “Recebimentos” da ordem de serviço. Editar a OS não altera
                    o histórico financeiro.
                  </p>
                </div>

                <label className="wide">
                  Observações comerciais
                  <textarea
                    value={orderForm.notes}
                    onChange={e => setOrderForm({
                      ...orderForm,
                      notes: e.target.value
                    })}
                  />
                </label>

                <div className="order-total wide">
                  <span>Total calculado</span>
                  <b>
                    {money(getOrderItemsTotal(orderForm.items))}
                  </b>
                </div>

                <div className="form-actions wide">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setModal('')}
                  >
                    Cancelar
                  </button>
                  <button className="primary" disabled={busy}>
                    {busy
                      ? 'Salvando...'
                      : editing
                        ? 'Salvar alterações'
                        : 'Criar OS'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {mockupPreview && (
        <div
          className="modal-backdrop"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setMockupPreview(null)
          }}
        >
          <div className="modal image-modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">REFERÊNCIA VISUAL</p>
                <h3>
                  OS #{String(mockupPreview.number).padStart(5, '0')}
                </h3>
              </div>
              <button
                className="icon-btn"
                onClick={() => setMockupPreview(null)}
              >
                <X />
              </button>
            </div>

            <img
              src={mockupPreview.mockupSignedUrl}
              alt={`Mockup da OS ${mockupPreview.number}`}
            />

            {!mockupPreview.mockupSignedUrl && (
              <p className="muted">
                Não foi possível carregar a imagem. Atualize a página e tente novamente.
              </p>
            )}
          </div>
        </div>
      )}

      {selectedOrder && (
        <div className="print-sheet">
          <div className="print-controls">
            <button
              type="button"
              className="secondary"
              onClick={() => window.print()}
            >
              <Printer size={15} /> Imprimir ficha
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setSelectedOrder(null)}
            >
              Fechar
            </button>
          </div>

          <div className="print-head">
            <div className="brand-mark">D</div>
            <div>
              <h1>DCS CONFECÇÃO</h1>
              <p>FICHA DE PRODUÇÃO · ORDEM DE SERVIÇO</p>
            </div>
            <strong>
              OS #{String(selectedOrder.number).padStart(5, '0')}
            </strong>
          </div>

          <div className="print-grid">
            <div>
              <b>Cliente</b>
              <span>{selectedOrder.clients?.name || 'Não informado'}</span>
            </div>
            <div>
              <b>Telefone</b>
              <span>
                {selectedOrder.clients?.phone ||
                  selectedOrder.clients?.whatsapp || '—'}
              </span>
            </div>
            <div>
              <b>Data da OS</b>
              <span>{dateBR(selectedOrder.created_at?.slice(0, 10))}</span>
            </div>
            <div>
              <b>Entrega prevista</b>
              <span>{dateBR(selectedOrder.due_date)}</span>
            </div>
            <div>
              <b>Status</b>
              <span>{selectedOrder.status}</span>
            </div>
            <div>
              <b>Pagamento</b>
              <span>{selectedOrder.payment_status || '—'}</span>
            </div>
          </div>

          <h2>Itens, grade e quantidades</h2>
          <table className="print-items-table">
            <thead>
              <tr>
                <th>Produto / descrição</th>
                {sizeKeys.map(size => <th key={size}>{size}</th>)}
                <th>Total</th>
                <th>Valor unit.</th>
                <th>Total item</th>
              </tr>
            </thead>
            <tbody>
              {(selectedOrder.work_order_items || []).map((item, index) => (
                <tr key={index}>
                  <td>{item.description}</td>
                  {sizeKeys.map(size => <td key={size}>{Number(item.size_breakdown?.[size]) > 0 ? item.size_breakdown[size] : '—'}</td>)}
                  <td><b>{getItemQuantity(item)}</b></td>
                  <td>{money(item.unit_price)}</td>
                  <td>{money(getItemQuantity(item) * Number(item.unit_price))}</td>
                </tr>
              ))}
              <tr className="print-total-row">
                <td><b>TOTAL DE PEÇAS</b></td>
                {sizeKeys.map(size => <td key={size}><b>{(selectedOrder.work_order_items || []).reduce((sum, item) => sum + (Number(item.size_breakdown?.[size]) || 0), 0) || '—'}</b></td>)}
                <td><b>{(selectedOrder.work_order_items || []).reduce((sum, item) => sum + getItemQuantity(item), 0)}</b></td>
                <td>—</td>
                <td><b>{money((selectedOrder.work_order_items || []).reduce((sum, item) => sum + getItemQuantity(item) * Number(item.unit_price), 0))}</b></td>
              </tr>
            </tbody>
          </table>

          <h2>Especificações de produção</h2>
          <div className="print-grid">
            <div>
              <b>Tecido</b>
              <span>{selectedOrder.production_details?.fabric || '—'}</span>
            </div>
            <div>
              <b>Técnica</b>
              <span>{selectedOrder.production_details?.printTechnique || '—'}</span>
            </div>
            <div>
              <b>Etapa atual</b>
              <span>{getProductionStage(selectedOrder)}</span>
            </div>
            <div>
              <b>Quantidade por cor</b>
              <span>{selectedOrder.production_details?.colorBreakdown || '—'}</span>
            </div>
            <div>
              <b>Cores da estampa</b>
              <span>{selectedOrder.production_details?.printColors || '—'}</span>
            </div>
            <div>
              <b>Frente</b>
              <span>{selectedOrder.production_details?.front || '—'}</span>
            </div>
            <div>
              <b>Costas</b>
              <span>{selectedOrder.production_details?.back || '—'}</span>
            </div>
            <div>
              <b>Mangas</b>
              <span>{selectedOrder.production_details?.sleeves || '—'}</span>
            </div>
            <div className="print-wide">
              <b>Instruções de produção</b>
              <span>{selectedOrder.production_details?.instructions || '—'}</span>
            </div>
          </div>

          {selectedOrder.mockupSignedUrl && (
            <>
              <h2>Mockup de referência</h2>
              <img
                className="print-mockup"
                src={selectedOrder.mockupSignedUrl}
                alt="Mockup de referência"
              />
            </>
          )}

          <h2>Conferência da produção</h2>
          <div className="print-checklist">
            {['Separação das peças', 'Preparação das telas / arquivos', 'Estamparia', 'Acabamento', 'Conferência de tamanhos e quantidades', 'Embalagem'].map(step => (
              <div key={step}><span className="print-check-box" />{step}</div>
            ))}
          </div>
          {selectedOrder.production_details?.stageHistory?.length > 0 && (
            <>
              <h2>Histórico das etapas</h2>
              <table className="print-history-table">
                <thead><tr><th>Etapa concluída</th><th>Início registrado</th><th>Conclusão</th><th>Duração</th></tr></thead>
                <tbody>{selectedOrder.production_details.stageHistory.map((entry, index) => (
                  <tr key={index}><td>{entry.stage}</td><td>{entry.startedAt ? new Date(entry.startedAt).toLocaleString('pt-BR') : 'Não registrado'}</td><td>{new Date(entry.endedAt).toLocaleString('pt-BR')}</td><td>{entry.durationMinutes == null ? '—' : formatDuration(entry.durationMinutes)}</td></tr>
                ))}</tbody>
              </table>
            </>
          )}

          <div className="print-notes">
            <b>Observações</b>
            <p>{selectedOrder.notes || ' '}</p>
          </div>

          <div className="signature-row">
            <div>Conferido por: __________________________</div>
            <div>Produção: ______________________________</div>
            <div>Conferência final: _______________________</div>
          </div>

          <section className="cut-sheet-page">
            <div className="print-head">
              <div className="brand-mark">D</div>
              <div>
                <h1>DCS CONFECÇÃO</h1>
                <p>FICHA DE CORTE · SEPARAÇÃO DE QUANTIDADES</p>
              </div>
              <strong>OS #{String(selectedOrder.number).padStart(5, '0')}</strong>
            </div>

            <div className="cut-sheet-identification">
              <div><b>Cliente:</b> {selectedOrder.clients?.name || 'Não informado'}</div>
              <div><b>Data:</b> {dateBR(selectedOrder.created_at?.slice(0, 10))}</div>
              <div><b>Entrega:</b> {dateBR(selectedOrder.due_date)}</div>
            </div>

            <h2>Separação por produto e tamanho</h2>
            <table className="print-items-table cut-items-table">
              <thead>
                <tr>
                  <th>Produto / descrição</th>
                  {sizeKeys.map(size => <th key={size}>{size}</th>)}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {(selectedOrder.work_order_items || []).map((item, index) => (
                  <tr key={index}>
                    <td>{item.description || `Produto ${index + 1}`}</td>
                    {sizeKeys.map(size => <td key={size}>{Number(item.size_breakdown?.[size]) > 0 ? item.size_breakdown[size] : '—'}</td>)}
                    <td><b>{getItemQuantity(item)}</b></td>
                  </tr>
                ))}
                <tr className="print-total-row">
                  <td><b>TOTAL GERAL</b></td>
                  {sizeKeys.map(size => <td key={size}><b>{(selectedOrder.work_order_items || []).reduce((sum, item) => sum + (Number(item.size_breakdown?.[size]) || 0), 0) || '—'}</b></td>)}
                  <td><b>{(selectedOrder.work_order_items || []).reduce((sum, item) => sum + getItemQuantity(item), 0)}</b></td>
                </tr>
              </tbody>
            </table>

            {(selectedOrder.work_order_items || []).some(item => item.legacyQuantity && !getSizeTotal(item.size_breakdown)) && (
              <p className="cut-legacy-note">Atenção: há item(ns) sem grade de tamanhos cadastrada. A quantidade total foi mantida, mas precisa ser distribuída/conferida manualmente no corte.</p>
            )}

            <h2>Conferência do corte</h2>
            <div className="cut-checklist">
              <div><span className="print-check-box" /> Quantidades conferidas com a OS</div>
              <div><span className="print-check-box" /> Tamanhos separados</div>
              <div><span className="print-check-box" /> Peças cortadas</div>
              <div><span className="print-check-box" /> Pacotes identificados por produto</div>
            </div>

            <div className="cut-notes">
              <b>Observações do corte</b>
              <div></div><div></div>
            </div>
            <div className="cut-signatures">
              <span>Responsável pelo corte: ______________________________</span>
              <span>Conferido por: ________________________________________</span>
              <span>Data: ____/____/________</span>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function SetupScreen() {
  return (
    <div className="setup-wrap">
      <div className="setup-card">
        <div className="brand-mark">D</div>
        <p className="eyebrow">DCS CONFECÇÃO</p>
        <h1>Configuração inicial</h1>
        <p>
          Crie o arquivo <b>.env</b> na pasta do projeto e informe as credenciais
          públicas do seu projeto Supabase.
        </p>
        <pre>
          VITE_SUPABASE_URL=https://...supabase.co
          {"\n"}
          VITE_SUPABASE_ANON_KEY=sua-chave-anon
        </pre>
        <p className="muted">
          Nunca coloque a chave service_role no navegador.
        </p>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-icon"><Icon size={19} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="searchbox">
      <Search size={17} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

function Empty({ text }) {
  return (
    <div className="empty">
      <Package size={25} />
      {text}
    </div>
  )
}

function OrderTable({
  orders,
  changeStatus,
  onView,
  onMockup,
  onEdit,
  onDelete,
  onPayments,
  onMessage,
  onTracking
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>OS</th>
            <th>Cliente</th>
            <th>Data</th>
            <th>Entrega</th>
            <th>Valor total</th>
            <th>Recebido</th>
            <th>Falta receber</th>
            <th>Status</th>
            <th>Mockup / ficha</th>
            <th>Ações</th>
          </tr>
        </thead>

        <tbody>
          {orders.map(order => {
            const total = Number(order.total) || 0
            const received = Number(order.amount_paid) || 0
            const balance = Math.max(0, total - received)

            return (
              <tr key={order.id}>
                <td>
                  <b>#{String(order.number).padStart(5, '0')}</b>
                </td>
                <td>{order.clients?.name || 'Cliente não informado'}</td>
                <td>{dateBR(order.created_at?.slice(0, 10))}</td>
                <td>{dateBR(order.due_date)}</td>
                <td>{money(total)}</td>
                <td>{money(received)}</td>
                <td>
                  <strong style={{
                    color: balance > 0 ? '#d97706' : '#16a34a'
                  }}>
                    {money(balance)}
                  </strong>
                </td>
                <td>
                  <select
                    className="status-select"
                    value={order.status}
                    onChange={e => changeStatus(order.id, e.target.value)}
                  >
                    {[
                      'Orçamento',
                      'Aguardando aprovação',
                      'Aprovada',
                      'Em produção',
                      'Concluída',
                      'Entregue',
                      'Cancelada'
                    ].map(status => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>

                  <small style={{
                    display: 'block',
                    marginTop: 4
                  }}>
                    Pagamento: {order.payment_status || 'Pendente'}
                  </small>
                </td>

                <td>
                  <div className="order-actions">
                    {order.mockupSignedUrl
                      ? (
                        <button
                          className="secondary small"
                          title="Ver mockup"
                          onClick={() => onMockup(order)}
                        >
                          <Eye size={14} /> Mockup
                        </button>
                      )
                      : <span className="muted">Sem imagem</span>
                    }

                    <button
                      className="secondary small"
                      title="Abrir ficha para impressão"
                      onClick={() => onView(order)}
                    >
                      <Printer size={14} /> Ficha
                    </button>
                  </div>
                </td>

                <td>
                  <div className="order-actions">
                    <button className="secondary small" title="Enviar atualização pelo WhatsApp" onClick={() => onMessage(order)}><MessageCircle size={13}/> WhatsApp</button>
                    <button className="secondary small" title="Copiar link de acompanhamento" onClick={() => onTracking(order)}><Link2 size={13}/> Link</button>
                    <button
                      className="secondary small"
                      title="Histórico e registro de recebimentos"
                      onClick={() => onPayments(order)}
                    >
                      <Wallet size={14} /> Recebimentos
                    </button>

                    <button
                      className="secondary small"
                      title="Editar OS"
                      onClick={() => onEdit(order)}
                    >
                      Editar
                    </button>

                    <button
                      className="secondary small"
                      title="Excluir OS"
                      onClick={() => onDelete(order)}
                    >
                      <Trash2 size={14} /> Excluir
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {!orders.length && (
        <Empty text="Nenhuma ordem de serviço cadastrada." />
      )}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
