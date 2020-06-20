import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    if (!products) throw new AppError('product was not informed', 400);

    const [customer, ps = []] = await Promise.all([
      this.customersRepository.findById(customer_id),
      this.productsRepository.findAllById(products),
    ]);
    if (!customer) throw new AppError('Customer not found', 404);
    const prodsOrder = ps.map(pr => {
      const { id, price, quantity } = pr;
      const p = products.find(prd => prd.id === id);
      if (!p || p.quantity > quantity)
        throw new AppError('invalid quantity', 400);
      return {
        product_id: id,
        price,
        quantity: p.quantity,
      };
    });
    const prods = prodsOrder.map(p => {
      const product = ps.find(prd => p.product_id === prd.id);
      if (!product) throw new AppError('Product not found', 404);
      return { id: p.product_id, quantity: product.quantity - p.quantity };
    });

    await this.productsRepository.updateQuantity(prods);
    return this.ordersRepository.create({ products: prodsOrder, customer });
  }
}

export default CreateOrderService;
