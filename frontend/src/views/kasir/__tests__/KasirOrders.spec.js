import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import KasirOrders from '../KasirOrders.vue'
import api from '@/services/api'
import Swal from 'sweetalert2'

// Mock dependencies
vi.mock('@/services/api')
vi.mock('sweetalert2')

// Mock router
const createMockRouter = () => {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/kasir', component: { template: '<div>Kasir</div>' } },
      { path: '/kasir/pos', component: { template: '<div>POS</div>' } },
    ],
  })
}

// Mock data helpers
const createMockOrder = (overrides = {}) => ({
  id: 1,
  status: 'DRAFT',
  created_at: '2024-01-01T10:00:00Z',
  total: 100000,
  items: [
    {
      service_name: 'Massage',
      qty: 1,
      price: 100000,
      subtotal: 100000,
      therapist_name: 'John',
      is_fnb: false,
      is_delivered: false,
    },
  ],
  therapist_name: 'John',
  room_name: 'Room 1',
  ...overrides,
})

const createMockPaginatedResponse = (orders = [], page = 1, limit = 25) => ({
  data: {
    data: orders,
    pagination: {
      page,
      limit,
      totalRecords: orders.length,
      totalPages: Math.ceil(orders.length / limit),
    },
  },
})

describe('KasirOrders.vue', () => {
  let router
  let wrapper

  beforeEach(() => {
    router = createMockRouter()
    vi.clearAllMocks()

    // Default API mocks
    api.get.mockResolvedValue(createMockPaginatedResponse([]))
    Swal.fire.mockResolvedValue({ isConfirmed: false })
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  const mountComponent = async (options = {}) => {
    wrapper = mount(KasirOrders, {
      global: {
        plugins: [router],
        stubs: {
          teleport: true,
        },
      },
      ...options,
    })
    await flushPromises()
    return wrapper
  }

  describe('Component Initialization', () => {
    it('should render the component with header', async () => {
      await mountComponent()
      expect(wrapper.find('h1').text()).toBe('Daftar Order')
      expect(wrapper.find('.subtitle').text()).toBe('Semua transaksi kasir')
    })

    it('should call loadOrders on mount', async () => {
      const mockOrders = [createMockOrder()]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))

      await mountComponent()

      expect(api.get).toHaveBeenCalledWith('/orders/kasir', expect.any(Object))
    })

    it('should call loadTherapists on mount', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/therapists') {
          return Promise.resolve({ data: [{ id: 1, name: 'John' }] })
        }
        return Promise.resolve(createMockPaginatedResponse([]))
      })

      await mountComponent()

      expect(api.get).toHaveBeenCalledWith('/therapists')
    })

    it('should call loadRooms on mount', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/rooms') {
          return Promise.resolve({ data: [{ id: 1, name: 'Room 1' }] })
        }
        return Promise.resolve(createMockPaginatedResponse([]))
      })

      await mountComponent()

      expect(api.get).toHaveBeenCalledWith('/rooms')
    })

    it('should set up polling interval on mount', async () => {
      vi.useFakeTimers()
      await mountComponent()

      const initialCallCount = api.get.mock.calls.length

      vi.advanceTimersByTime(10000)
      await flushPromises()

      expect(api.get.mock.calls.length).toBeGreaterThan(initialCallCount)

      vi.useRealTimers()
    })
  })

  describe('Filters', () => {
    it('should render all filter options', async () => {
      await mountComponent()

      expect(wrapper.find('select[id="status-filter"]').exists() ||
             wrapper.findAll('select').length).toBeGreaterThan(0)
    })

    it('should apply status filter when changed', async () => {
      api.get.mockResolvedValue(createMockPaginatedResponse([]))
      await mountComponent()

      const statusSelect = wrapper.findAll('select')[0]
      await statusSelect.setValue('PAID')
      await flushPromises()

      expect(api.get).toHaveBeenCalledWith(
        '/orders/kasir',
        expect.objectContaining({
          params: expect.objectContaining({
            status: 'PAID',
          }),
        })
      )
    })

    it('should apply date range filter - today', async () => {
      api.get.mockResolvedValue(createMockPaginatedResponse([]))
      await mountComponent()

      const dateRangeSelect = wrapper.findAll('select')[1]
      await dateRangeSelect.setValue('today')
      await flushPromises()

      const today = new Date().toISOString().split('T')[0]
      expect(api.get).toHaveBeenCalledWith(
        '/orders/kasir',
        expect.objectContaining({
          params: expect.objectContaining({
            date_from: today,
            date_to: today,
          }),
        })
      )
    })

    it('should apply date range filter - 7 days', async () => {
      api.get.mockResolvedValue(createMockPaginatedResponse([]))
      await mountComponent()

      const dateRangeSelect = wrapper.findAll('select')[1]
      await dateRangeSelect.setValue('7days')
      await flushPromises()

      expect(api.get).toHaveBeenCalledWith(
        '/orders/kasir',
        expect.objectContaining({
          params: expect.objectContaining({
            date_from: expect.any(String),
            date_to: expect.any(String),
          }),
        })
      )
    })

    it('should show custom date inputs when custom range selected', async () => {
      await mountComponent()

      const dateRangeSelect = wrapper.findAll('select')[1]
      await dateRangeSelect.setValue('custom')
      await wrapper.vm.$nextTick()

      const dateInputs = wrapper.findAll('input[type="date"]')
      expect(dateInputs.length).toBeGreaterThan(1)
    })

    it('should reset filters when reset button clicked', async () => {
      await mountComponent()

      // Change some filters
      const statusSelect = wrapper.findAll('select')[0]
      await statusSelect.setValue('PAID')
      await flushPromises()

      // Click reset
      const resetButton = wrapper.find('.btn-reset')
      await resetButton.trigger('click')
      await flushPromises()

      expect(wrapper.vm.filters.status).toBe('ALL')
      expect(wrapper.vm.filters.dateRange).toBe('all')
    })

    it('should reset page to 1 when filters change', async () => {
      await mountComponent()

      wrapper.vm.pagination.page = 3

      const statusSelect = wrapper.findAll('select')[0]
      await statusSelect.setValue('PAID')
      await flushPromises()

      expect(wrapper.vm.pagination.page).toBe(1)
    })
  })

  describe('Order Display', () => {
    it('should display orders in table', async () => {
      const mockOrders = [
        createMockOrder({ id: 1, total: 100000 }),
        createMockOrder({ id: 2, total: 200000 }),
      ]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))

      await mountComponent()

      const rows = wrapper.findAll('tbody tr')
      expect(rows.length).toBe(2)
    })

    it('should display order details correctly', async () => {
      const mockOrder = createMockOrder({
        id: 123,
        total: 150000,
        therapist_name: 'Jane Doe',
        room_name: 'VIP Room',
        status: 'PAID',
      })
      api.get.mockResolvedValue(createMockPaginatedResponse([mockOrder]))

      await mountComponent()

      const tableText = wrapper.find('tbody').text()
      expect(tableText).toContain('#123')
      expect(tableText).toContain('150')
      expect(tableText).toContain('Jane Doe')
      expect(tableText).toContain('VIP Room')
      expect(tableText).toContain('PAID')
    })

    it('should display service items with quantity', async () => {
      const mockOrder = createMockOrder({
        items: [
          {
            service_name: 'Body Massage',
            qty: 2,
            price: 100000,
            subtotal: 200000,
          },
        ],
      })
      api.get.mockResolvedValue(createMockPaginatedResponse([mockOrder]))

      await mountComponent()

      expect(wrapper.text()).toContain('Body Massage')
      expect(wrapper.text()).toContain('×2')
    })

    it('should show delivered check for delivered FnB items', async () => {
      const mockOrder = createMockOrder({
        items: [
          {
            service_name: 'Coffee',
            qty: 1,
            is_fnb: true,
            is_delivered: true,
          },
        ],
      })
      api.get.mockResolvedValue(createMockPaginatedResponse([mockOrder]))

      await mountComponent()

      expect(wrapper.find('.delivered-check').exists()).toBe(true)
    })

    it('should display empty state when no orders', async () => {
      api.get.mockResolvedValue(createMockPaginatedResponse([]))

      await mountComponent()

      expect(wrapper.find('.empty').text()).toBe('Tidak ada order')
    })

    it('should show loading indicator', async () => {
      let resolvePromise
      api.get.mockReturnValue(new Promise((resolve) => {
        resolvePromise = resolve
      }))

      await mountComponent()

      expect(wrapper.find('.loading').exists()).toBe(true)

      resolvePromise(createMockPaginatedResponse([]))
      await flushPromises()

      expect(wrapper.find('.loading').exists()).toBe(false)
    })
  })

  describe('Pagination', () => {
    it('should display pagination info', async () => {
      const mockOrders = Array.from({ length: 5 }, (_, i) =>
        createMockOrder({ id: i + 1 })
      )
      api.get.mockResolvedValue({
        data: {
          data: mockOrders,
          pagination: { page: 1, limit: 25, totalRecords: 100, totalPages: 4 },
        },
      })

      await mountComponent()

      expect(wrapper.find('.result-count').text()).toContain('Menampilkan 5 dari 100 transaksi')
      expect(wrapper.find('.result-count').text()).toContain('Halaman 1 dari 4')
    })

    it('should change page when next button clicked', async () => {
      const mockOrders = [createMockOrder({ id: 1 })]
      api.get.mockResolvedValue({
        data: {
          data: mockOrders,
          pagination: { page: 1, limit: 25, totalRecords: 50, totalPages: 2 },
        },
      })

      await mountComponent()

      const nextButton = wrapper.findAll('.page-btn')[1]
      await nextButton.trigger('click')
      await flushPromises()

      expect(api.get).toHaveBeenCalledWith(
        '/orders/kasir',
        expect.objectContaining({
          params: expect.objectContaining({
            page: 2,
          }),
        })
      )
    })

    it('should change page when prev button clicked', async () => {
      const mockOrders = [createMockOrder({ id: 1 })]
      let currentPage = 2

      api.get.mockImplementation(() => {
        return Promise.resolve({
          data: {
            data: mockOrders,
            pagination: { page: currentPage, limit: 25, totalRecords: 50, totalPages: 2 },
          },
        })
      })

      await mountComponent()

      currentPage = 1
      const prevButton = wrapper.findAll('.page-btn')[0]
      await prevButton.trigger('click')
      await flushPromises()

      expect(wrapper.vm.pagination.page).toBe(1)
    })

    it('should disable prev button on first page', async () => {
      const mockOrders = [createMockOrder({ id: 1 })]
      api.get.mockResolvedValue({
        data: {
          data: mockOrders,
          pagination: { page: 1, limit: 25, totalRecords: 50, totalPages: 2 },
        },
      })

      await mountComponent()

      const prevButton = wrapper.findAll('.page-btn')[0]
      expect(prevButton.attributes('disabled')).toBeDefined()
    })

    it('should disable next button on last page', async () => {
      const mockOrders = [createMockOrder({ id: 1 })]
      api.get.mockResolvedValue({
        data: {
          data: mockOrders,
          pagination: { page: 2, limit: 25, totalRecords: 50, totalPages: 2 },
        },
      })

      await mountComponent()

      const nextButton = wrapper.findAll('.page-btn')[1]
      expect(nextButton.attributes('disabled')).toBeDefined()
    })

    it('should change limit when per-page selector changed', async () => {
      const mockOrders = [createMockOrder({ id: 1 })]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))

      await mountComponent()

      const limitSelect = wrapper.find('.per-page select')
      await limitSelect.setValue(50)
      await flushPromises()

      expect(api.get).toHaveBeenCalledWith(
        '/orders/kasir',
        expect.objectContaining({
          params: expect.objectContaining({
            limit: 50,
            page: 1,
          }),
        })
      )
    })

    it('should jump to specific page', async () => {
      const mockOrders = [createMockOrder({ id: 1 })]
      let currentPage = 1

      api.get.mockImplementation(() => {
        return Promise.resolve({
          data: {
            data: mockOrders,
            pagination: { page: currentPage, limit: 25, totalRecords: 100, totalPages: 4 },
          },
        })
      })

      await mountComponent()

      const jumpInput = wrapper.find('.jump-to-page input')
      const jumpButton = wrapper.find('.jump-to-page button')

      currentPage = 3
      await jumpInput.setValue(3)
      await jumpButton.trigger('click')
      await flushPromises()

      expect(wrapper.vm.pagination.page).toBe(3)
    })
  })

  describe('Checkbox Selection', () => {
    it('should show checkbox only for draft orders', async () => {
      const mockOrders = [
        createMockOrder({ id: 1, status: 'DRAFT' }),
        createMockOrder({ id: 2, status: 'PAID' }),
      ]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))

      await mountComponent()

      const checkboxes = wrapper.findAll('tbody input[type="checkbox"]')
      expect(checkboxes.length).toBe(1)
    })

    it('should toggle order selection when checkbox clicked', async () => {
      const mockOrders = [createMockOrder({ id: 1, status: 'DRAFT' })]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))

      await mountComponent()

      const checkbox = wrapper.find('tbody input[type="checkbox"]')
      await checkbox.setChecked(true)

      expect(wrapper.vm.selectedOrderIds).toContain(1)

      await checkbox.setChecked(false)

      expect(wrapper.vm.selectedOrderIds).not.toContain(1)
    })

    it('should select all draft orders on page when header checkbox clicked', async () => {
      const mockOrders = [
        createMockOrder({ id: 1, status: 'DRAFT' }),
        createMockOrder({ id: 2, status: 'DRAFT' }),
        createMockOrder({ id: 3, status: 'PAID' }),
      ]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))

      await mountComponent()

      const headerCheckbox = wrapper.find('thead input[type="checkbox"]')
      await headerCheckbox.setChecked(true)

      expect(wrapper.vm.selectedOrderIds).toContain(1)
      expect(wrapper.vm.selectedOrderIds).toContain(2)
      expect(wrapper.vm.selectedOrderIds).not.toContain(3)
    })

    it('should deselect all draft orders on page when header checkbox unchecked', async () => {
      const mockOrders = [
        createMockOrder({ id: 1, status: 'DRAFT' }),
        createMockOrder({ id: 2, status: 'DRAFT' }),
      ]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))

      await mountComponent()

      wrapper.vm.selectedOrderIds = [1, 2]
      await wrapper.vm.$nextTick()

      const headerCheckbox = wrapper.find('thead input[type="checkbox"]')
      await headerCheckbox.setChecked(false)

      expect(wrapper.vm.selectedOrderIds).toHaveLength(0)
    })

    it('should update selected count display', async () => {
      const mockOrders = [createMockOrder({ id: 1, status: 'DRAFT' })]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))

      await mountComponent()

      wrapper.vm.selectedOrderIds = [1]
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.bulk-actions span').text()).toContain('1 order dipilih')
    })

    it('should clear selections that are no longer on page after reload', async () => {
      api.get.mockResolvedValue(createMockPaginatedResponse([
        createMockOrder({ id: 1, status: 'DRAFT' }),
      ]))

      await mountComponent()

      wrapper.vm.selectedOrderIds = [1, 2, 3]
      await wrapper.vm.loadOrders()
      await flushPromises()

      expect(wrapper.vm.selectedOrderIds).toEqual([1])
    })
  })

  describe('Bulk Payment', () => {
    it('should disable bulk pay button when no orders selected', async () => {
      await mountComponent()

      const bulkPayButton = wrapper.find('.btn-bulk-pay')
      expect(bulkPayButton.attributes('disabled')).toBeDefined()
    })

    it('should enable bulk pay button when orders selected', async () => {
      const mockOrders = [createMockOrder({ id: 1, status: 'DRAFT' })]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))

      await mountComponent()

      wrapper.vm.selectedOrderIds = [1]
      await wrapper.vm.$nextTick()

      const bulkPayButton = wrapper.find('.btn-bulk-pay')
      expect(bulkPayButton.attributes('disabled')).toBeUndefined()
    })

    it('should show confirmation dialog when bulk pay clicked', async () => {
      const mockOrders = [createMockOrder({ id: 1, status: 'DRAFT' })]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))

      await mountComponent()

      wrapper.vm.selectedOrderIds = [1]
      await wrapper.vm.$nextTick()

      const bulkPayButton = wrapper.find('.btn-bulk-pay')
      await bulkPayButton.trigger('click')

      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Bayar gabungan?',
          icon: 'question',
        })
      )
    })

    it('should call API to pay bulk orders when confirmed', async () => {
      const mockOrders = [
        createMockOrder({ id: 1, status: 'DRAFT' }),
        createMockOrder({ id: 2, status: 'DRAFT' }),
      ]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))
      api.post.mockResolvedValue({
        data: {
          paid_order_ids: [1, 2],
          total: 200000,
          payment_method: 'CASH',
        },
      })
      Swal.fire.mockResolvedValueOnce({ isConfirmed: true })
        .mockResolvedValueOnce({ isConfirmed: false })

      await mountComponent()

      wrapper.vm.selectedOrderIds = [1, 2]
      await wrapper.vm.paySelectedOrders()
      await flushPromises()

      expect(api.post).toHaveBeenCalledWith('/orders/pay-bulk', {
        order_ids: [1, 2],
        payment_method: 'CASH',
      })
    })

    it('should clear selections after successful bulk payment', async () => {
      const mockOrders = [createMockOrder({ id: 1, status: 'DRAFT' })]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))
      api.post.mockResolvedValue({
        data: { paid_order_ids: [1], total: 100000 },
      })
      Swal.fire.mockResolvedValueOnce({ isConfirmed: true })
        .mockResolvedValueOnce({ isConfirmed: false })

      await mountComponent()

      wrapper.vm.selectedOrderIds = [1]
      await wrapper.vm.paySelectedOrders()
      await flushPromises()

      expect(wrapper.vm.selectedOrderIds).toHaveLength(0)
    })

    it('should show error when bulk payment fails', async () => {
      api.get.mockResolvedValue(createMockPaginatedResponse([]))
      api.post.mockRejectedValue({
        response: { data: { message: 'Payment failed' } },
      })
      Swal.fire.mockResolvedValueOnce({ isConfirmed: true })

      await mountComponent()

      wrapper.vm.selectedOrderIds = [1]
      await wrapper.vm.paySelectedOrders()
      await flushPromises()

      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: 'error',
          title: 'Gagal bayar gabungan',
        })
      )
    })

    it('should ask to print receipt after bulk payment', async () => {
      api.get.mockResolvedValue(createMockPaginatedResponse([]))
      api.post.mockResolvedValue({
        data: {
          paid_order_ids: [1, 2],
          total: 200000,
          payment_method: 'CASH',
        },
      })
      Swal.fire.mockResolvedValueOnce({ isConfirmed: true })
        .mockResolvedValueOnce({ isConfirmed: true })

      await mountComponent()

      wrapper.vm.selectedOrderIds = [1, 2]
      await wrapper.vm.paySelectedOrders()
      await flushPromises()

      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Pembayaran gabungan berhasil',
          icon: 'success',
        })
      )
    })
  })

  describe('Order Actions', () => {
    it('should show Pay button for draft orders', async () => {
      const mockOrders = [createMockOrder({ id: 1, status: 'DRAFT' })]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))

      await mountComponent()

      expect(wrapper.find('.btn.pay').exists()).toBe(true)
    })

    it('should navigate to POS when Pay button clicked', async () => {
      const mockOrders = [createMockOrder({ id: 1, status: 'DRAFT' })]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))
      Swal.fire.mockResolvedValue({ isConfirmed: true })

      await mountComponent()
      await router.isReady()

      const payButton = wrapper.find('.btn.pay')
      await payButton.trigger('click')
      await flushPromises()

      expect(router.currentRoute.value.path).toBe('/kasir/pos')
      expect(router.currentRoute.value.query.order_id).toBe('1')
    })

    it('should show Add Item button for draft orders', async () => {
      const mockOrders = [createMockOrder({ id: 1, status: 'DRAFT' })]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))

      await mountComponent()

      expect(wrapper.find('.btn.add-item').exists()).toBe(true)
    })

    it('should navigate to POS when Add Item clicked', async () => {
      const mockOrders = [createMockOrder({ id: 1, status: 'DRAFT' })]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))

      await mountComponent()
      await router.isReady()

      const addItemButton = wrapper.find('.btn.add-item')
      await addItemButton.trigger('click')
      await flushPromises()

      expect(router.currentRoute.value.path).toBe('/kasir/pos')
      expect(router.currentRoute.value.query.order_id).toBe('1')
    })

    it('should show VOID button for draft orders', async () => {
      const mockOrders = [createMockOrder({ id: 1, status: 'DRAFT' })]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))

      await mountComponent()

      expect(wrapper.find('.btn.void').exists()).toBe(true)
    })

    it('should show confirmation with reason input when void clicked', async () => {
      const mockOrders = [createMockOrder({ id: 1, status: 'DRAFT' })]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))

      await mountComponent()

      const voidButton = wrapper.find('.btn.void')
      await voidButton.trigger('click')

      expect(Swal.fire).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Void draft ini?',
          icon: 'warning',
          input: 'textarea',
          inputValidator: expect.any(Function),
        })
      )
    })

    it('should validate void reason is required', async () => {
      const mockOrders = [createMockOrder({ id: 1, status: 'DRAFT' })]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))

      await mountComponent()

      await wrapper.vm.voidDraft(mockOrders[0])

      const swalCall = Swal.fire.mock.calls[0][0]
      const validator = swalCall.inputValidator

      expect(validator('')).toBe('Void Reason wajib diisi')
      expect(validator('   ')).toBe('Void Reason wajib diisi')
      expect(validator('Valid reason')).toBeNull()
    })

    it('should call API to void order when confirmed', async () => {
      const mockOrders = [createMockOrder({ id: 1, status: 'DRAFT' })]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))
      api.delete.mockResolvedValue({})
      Swal.fire.mockResolvedValueOnce({
        isConfirmed: true,
        value: 'Wrong order',
      })

      await mountComponent()

      const voidButton = wrapper.find('.btn.void')
      await voidButton.trigger('click')
      await flushPromises()

      expect(api.delete).toHaveBeenCalledWith('/orders/1', {
        data: { reason: 'Wrong order' },
      })
    })

    it('should show Print button for paid orders', async () => {
      const mockOrders = [createMockOrder({ id: 1, status: 'PAID' })]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))

      await mountComponent()

      expect(wrapper.find('.btn.print').exists()).toBe(true)
    })

    it('should show Undo Void button for cancelled orders', async () => {
      const mockOrders = [createMockOrder({ id: 1, status: 'CANCELLED' })]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))

      await mountComponent()

      expect(wrapper.find('.btn.undo').exists()).toBe(true)
    })

    it('should call API to undo void when confirmed', async () => {
      const mockOrders = [createMockOrder({ id: 1, status: 'CANCELLED' })]
      api.get.mockResolvedValue(createMockPaginatedResponse(mockOrders))
      api.post.mockResolvedValue({
        data: { request: { id: 123 } },
      })
      Swal.fire.mockResolvedValueOnce({ isConfirmed: true })

      await mountComponent()

      const undoButton = wrapper.find('.btn.undo')
      await undoButton.trigger('click')
      await flushPromises()

      expect(api.post).toHaveBeenCalledWith(
        '/orders/1/undo-void/request',
        { reason: 'Kasir meminta undo void' }
      )
    })
  })

  describe('Print Receipt', () => {
    it('should load order detail and show modal when print clicked', async () => {
      const mockOrders = [createMockOrder({ id: 1, status: 'PAID' })]
      api.get.mockImplementation((url) => {
        if (url === '/orders/1/detail') {
          return Promise.resolve({
            data: {
              ...mockOrders[0],
              branch_name: 'NUMARS SPA',
              cashier_name: 'John',
            },
          })
        }
        return Promise.resolve(createMockPaginatedResponse(mockOrders))
      })

      await mountComponent()

      const printButton = wrapper.find('.btn.print')
      await printButton.trigger('click')
      await flushPromises()

      expect(api.get).toHaveBeenCalledWith('/orders/1/detail')
      expect(wrapper.vm.showPrintModal).toBe(true)
      expect(wrapper.vm.printOrder).not.toBeNull()
    })

    it('should show receipt preview in modal', async () => {
      const mockOrders = [createMockOrder({ id: 1, status: 'PAID' })]
      api.get.mockImplementation((url) => {
        if (url === '/orders/1/detail') {
          return Promise.resolve({
            data: {
              ...mockOrders[0],
              branch_name: 'NUMARS SPA',
              branch_address: 'Jl. Test 123',
              branch_phone: '0812345678',
              cashier_name: 'John',
            },
          })
        }
        return Promise.resolve(createMockPaginatedResponse(mockOrders))
      })

      await mountComponent()

      const printButton = wrapper.find('.btn.print')
      await printButton.trigger('click')
      await flushPromises()

      const receipt = wrapper.find('.receipt')
      expect(receipt.exists()).toBe(true)
      expect(receipt.text()).toContain('NUMARS SPA')
      expect(receipt.text()).toContain('Jl. Test 123')
    })

    it('should call window.print when print button in modal clicked', async () => {
      const mockOrders = [createMockOrder({ id: 1, status: 'PAID' })]
      api.get.mockImplementation((url) => {
        if (url === '/orders/1/detail') {
          return Promise.resolve({ data: mockOrders[0] })
        }
        return Promise.resolve(createMockPaginatedResponse(mockOrders))
      })

      await mountComponent()

      wrapper.vm.showPrintModal = true
      wrapper.vm.printOrder = mockOrders[0]
      await wrapper.vm.$nextTick()

      const printNowButton = wrapper.find('.btn-print')
      await printNowButton.trigger('click')

      expect(window.print).toHaveBeenCalled()
    })

    it('should close modal when close button clicked', async () => {
      await mountComponent()

      wrapper.vm.showPrintModal = true
      wrapper.vm.printOrder = createMockOrder()
      await wrapper.vm.$nextTick()

      const closeButton = wrapper.find('.modal-close')
      await closeButton.trigger('click')

      expect(wrapper.vm.showPrintModal).toBe(false)
      expect(wrapper.vm.printOrder).toBeNull()
    })

    it('should close modal when cancel button clicked', async () => {
      await mountComponent()

      wrapper.vm.showPrintModal = true
      wrapper.vm.printOrder = createMockOrder()
      await wrapper.vm.$nextTick()

      const cancelButton = wrapper.find('.btn-cancel')
      await cancelButton.trigger('click')

      expect(wrapper.vm.showPrintModal).toBe(false)
    })

    it('should format currency in receipt', async () => {
      await mountComponent()

      const formatted = wrapper.vm.formatRupiah(150000)
      expect(formatted).toMatch(/Rp\s*150/)
    })

    it('should format datetime correctly', async () => {
      await mountComponent()

      const formatted = wrapper.vm.formatDateTime('2024-01-15T10:30:00Z')
      expect(formatted).toBeTruthy()
      expect(typeof formatted).toBe('string')
    })

    it('should apply compact class for receipts with 3 or fewer items', async () => {
      await mountComponent()

      wrapper.vm.printOrder = createMockOrder({
        items: [
          { service_name: 'Item 1', qty: 1 },
          { service_name: 'Item 2', qty: 1 },
        ],
      })
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isCompactReceipt).toBe(true)
    })

    it('should not apply compact class for receipts with more than 3 items', async () => {
      await mountComponent()

      wrapper.vm.printOrder = createMockOrder({
        items: [
          { service_name: 'Item 1', qty: 1 },
          { service_name: 'Item 2', qty: 1 },
          { service_name: 'Item 3', qty: 1 },
          { service_name: 'Item 4', qty: 1 },
        ],
      })
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isCompactReceipt).toBe(false)
    })
  })

  describe('Bulk Receipt', () => {
    it('should load multiple order details for bulk receipt', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/detail')) {
          const id = url.split('/')[2]
          return Promise.resolve({
            data: createMockOrder({
              id: Number(id),
              branch_name: 'NUMARS SPA',
            }),
          })
        }
        return Promise.resolve(createMockPaginatedResponse([]))
      })

      await mountComponent()

      await wrapper.vm.openBulkReceipt([1, 2], 200000, 'CASH')
      await flushPromises()

      expect(api.get).toHaveBeenCalledWith('/orders/1/detail')
      expect(api.get).toHaveBeenCalledWith('/orders/2/detail')
      expect(wrapper.vm.bulkReceipt).not.toBeNull()
    })

    it('should merge items from multiple orders', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/orders/1/detail') {
          return Promise.resolve({
            data: {
              ...createMockOrder({ id: 1 }),
              items: [{ service_name: 'Service A', order_id: 1 }],
            },
          })
        }
        if (url === '/orders/2/detail') {
          return Promise.resolve({
            data: {
              ...createMockOrder({ id: 2 }),
              items: [{ service_name: 'Service B', order_id: 2 }],
            },
          })
        }
        return Promise.resolve(createMockPaginatedResponse([]))
      })

      await mountComponent()

      await wrapper.vm.openBulkReceipt([1, 2], 200000, 'CASH')
      await flushPromises()

      expect(wrapper.vm.bulkReceipt.items.length).toBe(2)
      expect(wrapper.vm.bulkReceipt.order_ids).toEqual([1, 2])
    })

    it('should display bulk receipt with order IDs', async () => {
      api.get.mockImplementation((url) => {
        if (url.includes('/detail')) {
          return Promise.resolve({
            data: createMockOrder({ branch_name: 'NUMARS SPA' }),
          })
        }
        return Promise.resolve(createMockPaginatedResponse([]))
      })

      await mountComponent()

      await wrapper.vm.openBulkReceipt([1, 2, 3], 300000, 'CASH')
      await flushPromises()

      const receipt = wrapper.find('.receipt')
      expect(receipt.text()).toContain('PEMBAYARAN GABUNGAN')
      expect(receipt.text()).toContain('#1, #2, #3')
    })
  })

  describe('Navigation', () => {
    it('should navigate back to kasir when back button clicked', async () => {
      await mountComponent()
      await router.isReady()

      const backButton = wrapper.find('.back-btn')
      await backButton.trigger('click')
      await flushPromises()

      expect(router.currentRoute.value.path).toBe('/kasir')
    })
  })

  describe('Formatting Helpers', () => {
    it('should format numbers correctly', async () => {
      await mountComponent()

      expect(wrapper.vm.format(1000000)).toBe('1.000.000')
      expect(wrapper.vm.format(0)).toBe('0')
      expect(wrapper.vm.format(null)).toBe('0')
    })

    it('should format dates correctly', async () => {
      await mountComponent()

      const formatted = wrapper.vm.formatDate('2024-01-15T10:30:00Z')
      expect(formatted).toBeTruthy()
      expect(typeof formatted).toBe('string')
    })
  })

  describe('Edge Cases', () => {
    it('should handle API errors gracefully', async () => {
      api.get.mockRejectedValue(new Error('Network error'))
      console.error = vi.fn()

      await mountComponent()

      expect(console.error).toHaveBeenCalled()
      expect(wrapper.vm.orders).toEqual([])
    })

    it('should handle empty therapist response', async () => {
      api.get.mockImplementation((url) => {
        if (url === '/therapists') {
          return Promise.resolve({ data: null })
        }
        return Promise.resolve(createMockPaginatedResponse([]))
      })

      await mountComponent()

      expect(wrapper.vm.therapists).toEqual([])
    })

    it('should handle malformed pagination data', async () => {
      api.get.mockResolvedValue({
        data: {
          data: [],
          pagination: {
            page: undefined,
            limit: undefined,
            totalRecords: undefined,
            totalPages: undefined,
          },
        },
      })

      await mountComponent()

      // Check that pagination structure exists even with undefined values
      expect(wrapper.vm.pagination).toBeDefined()
      expect(typeof wrapper.vm.pagination).toBe('object')
    })

    it('should prevent navigation to invalid page numbers', async () => {
      api.get.mockResolvedValue({
        data: {
          data: [],
          pagination: { page: 1, limit: 25, totalRecords: 25, totalPages: 1 },
        },
      })

      await mountComponent()

      wrapper.vm.changePage(0)
      expect(wrapper.vm.pagination.page).toBe(1)

      wrapper.vm.changePage(5)
      expect(wrapper.vm.pagination.page).toBe(1)
    })

    it('should handle empty order IDs in bulk receipt', async () => {
      await mountComponent()

      await wrapper.vm.openBulkReceipt([], 0, 'CASH')

      expect(wrapper.vm.bulkReceipt).toBeNull()
    })

    it('should filter out invalid order IDs in bulk receipt', async () => {
      // Create fresh mock for this test to avoid interference from mount
      vi.clearAllMocks()

      api.get.mockImplementation((url) => {
        if (url.includes('/detail')) {
          return Promise.resolve({
            data: createMockOrder({ id: 1 }),
          })
        }
        return Promise.resolve(createMockPaginatedResponse([]))
      })

      await mountComponent()

      // Clear the mock calls from mount
      vi.clearAllMocks()

      await wrapper.vm.openBulkReceipt([1, null, 'invalid', -1], 100000, 'CASH')
      await flushPromises()

      // Should only call detail API for valid ID (1)
      expect(api.get).toHaveBeenCalledTimes(1)
      expect(api.get).toHaveBeenCalledWith('/orders/1/detail')
    })

    it('should cleanup interval on unmount', async () => {
      vi.useFakeTimers()
      await mountComponent()

      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      wrapper.unmount()

      expect(clearIntervalSpy).toHaveBeenCalled()

      vi.useRealTimers()
    })
  })

  describe('Page Range Calculation', () => {
    it('should calculate page range correctly for small number of pages', async () => {
      api.get.mockResolvedValue({
        data: {
          data: [],
          pagination: { page: 2, limit: 25, totalRecords: 75, totalPages: 3 },
        },
      })

      await mountComponent()

      const range = wrapper.vm.getPageRange()
      expect(range).toEqual([1, 2, 3])
    })

    it('should calculate page range correctly for large number of pages', async () => {
      api.get.mockResolvedValue({
        data: {
          data: [],
          pagination: { page: 5, limit: 25, totalRecords: 500, totalPages: 20 },
        },
      })

      await mountComponent()

      const range = wrapper.vm.getPageRange()
      expect(range.length).toBeLessThanOrEqual(5)
      expect(range).toContain(5)
    })
  })

  describe('Specific Date Filter', () => {
    it('should prioritize specific date over date range', async () => {
      api.get.mockResolvedValue(createMockPaginatedResponse([]))
      await mountComponent()

      wrapper.vm.filters.dateRange = 'today'
      wrapper.vm.filters.specificDate = '2024-01-15'
      await wrapper.vm.loadOrders()
      await flushPromises()

      expect(api.get).toHaveBeenCalledWith(
        '/orders/kasir',
        expect.objectContaining({
          params: expect.objectContaining({
            date_from: '2024-01-15',
            date_to: '2024-01-15',
          }),
        })
      )
    })
  })
})