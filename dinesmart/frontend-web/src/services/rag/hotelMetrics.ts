import { MetricCalculation } from './types';

export interface HotelRoomInventory {
  totalRooms: number;
  roomsSold: number;
  roomRevenue: number;
  periodDays?: number;
}

export interface DiningCapacity {
  totalTables: number;
  totalSeats: number;
  operatingHoursPerDay: number;
  totalOrdersCompleted: number;
  fbRevenue: number;
  totalFoodCost?: number;
}

export const hotelMetricsEngine = {
  // 1. Occupancy Rate: (Rooms Sold ÷ Rooms Available) * 100
  calculateOccupancyRate: (roomsSold: number, roomsAvailable: number): MetricCalculation => {
    if (roomsAvailable <= 0) {
      return {
        metricName: 'Occupancy Rate',
        formula: '(Rooms Sold ÷ Rooms Available) × 100',
        inputs: { roomsSold, roomsAvailable },
        calculatedValue: 0,
        formattedValue: '0.0%',
        unit: '%',
        interpretation: 'Invalid calculation: Rooms available must be greater than zero.'
      };
    }
    const val = (roomsSold / roomsAvailable) * 100;
    return {
      metricName: 'Occupancy Rate',
      formula: '(Rooms Sold ÷ Rooms Available) × 100',
      inputs: { roomsSold, roomsAvailable },
      calculatedValue: Math.round(val * 10) / 10,
      formattedValue: `${(Math.round(val * 10) / 10).toFixed(1)}%`,
      unit: '%',
      benchmarkOrTarget: '70% – 85% optimal hotel standard',
      interpretation: val >= 70 
        ? 'Healthy demand. Yield management can focus on ADR expansion.' 
        : 'Sub-optimal room utilization. Discounting or channel promotion recommended.'
    };
  },

  // 2. ADR (Average Daily Rate): Room Revenue ÷ Rooms Sold
  calculateADR: (roomRevenue: number, roomsSold: number): MetricCalculation => {
    if (roomsSold <= 0) {
      return {
        metricName: 'Average Daily Rate (ADR)',
        formula: 'Room Revenue ÷ Rooms Sold',
        inputs: { roomRevenue, roomsSold },
        calculatedValue: 0,
        formattedValue: '₹0.00',
        unit: '₹',
        interpretation: 'Cannot calculate ADR with 0 rooms sold.'
      };
    }
    const adr = roomRevenue / roomsSold;
    return {
      metricName: 'Average Daily Rate (ADR)',
      formula: 'Room Revenue ÷ Rooms Sold',
      inputs: { roomRevenue, roomsSold },
      calculatedValue: Math.round(adr * 100) / 100,
      formattedValue: `₹${(Math.round(adr * 100) / 100).toLocaleString('en-IN')}`,
      unit: '₹',
      benchmarkOrTarget: 'Competitive set dependent',
      interpretation: 'Average realized price per paid room night.'
    };
  },

  // 3. RevPAR (Revenue Per Available Room): Room Revenue ÷ Rooms Available
  // CRITICAL RULE: Denominator is TOTAL AVAILABLE ROOMS, NEVER occupied rooms!
  calculateRevPAR: (roomRevenue: number, roomsAvailable: number): MetricCalculation => {
    if (roomsAvailable <= 0) {
      return {
        metricName: 'RevPAR (Revenue Per Available Room)',
        formula: 'Room Revenue ÷ Total Rooms Available (Strict Denominator)',
        inputs: { roomRevenue, roomsAvailable },
        calculatedValue: 0,
        formattedValue: '₹0.00',
        unit: '₹',
        interpretation: 'Cannot calculate RevPAR with 0 available rooms.'
      };
    }
    const revpar = roomRevenue / roomsAvailable;
    return {
      metricName: 'RevPAR (Revenue Per Available Room)',
      formula: 'Room Revenue ÷ Total Rooms Available (Strict Denominator)',
      inputs: { roomRevenue, roomsAvailable },
      calculatedValue: Math.round(revpar * 100) / 100,
      formattedValue: `₹${(Math.round(revpar * 100) / 100).toLocaleString('en-IN')}`,
      unit: '₹',
      benchmarkOrTarget: 'Key revenue health index',
      interpretation: 'Reflects combined pricing power (ADR) and volume absorption (Occupancy).'
    };
  },

  // 4. RevPASH (Revenue Per Available Seat Hour for Dining): FB Revenue ÷ (Seats × Operating Hours)
  calculateRevPASH: (fbRevenue: number, totalSeats: number, operatingHours: number): MetricCalculation => {
    const totalSeatHours = totalSeats * operatingHours;
    if (totalSeatHours <= 0) {
      return {
        metricName: 'RevPASH (Revenue Per Available Seat Hour)',
        formula: 'F&B Revenue ÷ (Available Seats × Operating Hours)',
        inputs: { fbRevenue, totalSeats, operatingHours },
        calculatedValue: 0,
        formattedValue: '₹0.00/seat-hr',
        unit: '₹/seat-hr',
        interpretation: 'Invalid capacity parameters.'
      };
    }
    const revpash = fbRevenue / totalSeatHours;
    return {
      metricName: 'RevPASH (Revenue Per Available Seat Hour)',
      formula: 'F&B Revenue ÷ (Available Seats × Operating Hours)',
      inputs: { fbRevenue, totalSeats, operatingHours, totalSeatHours },
      calculatedValue: Math.round(revpash * 100) / 100,
      formattedValue: `₹${(Math.round(revpash * 100) / 100).toFixed(2)}/seat-hr`,
      unit: '₹/seat-hr',
      benchmarkOrTarget: '₹45 – ₹80/seat-hr for casual dining',
      interpretation: 'Demonstrates floor space monetization rate throughout operating hours.'
    };
  },

  // 5. Table Turnover Rate: Completed Orders ÷ Total Tables
  calculateTableTurnover: (completedOrders: number, totalTables: number): MetricCalculation => {
    if (totalTables <= 0) {
      return {
        metricName: 'Table Turnover Rate',
        formula: 'Completed Orders ÷ Total Tables',
        inputs: { completedOrders, totalTables },
        calculatedValue: 0,
        formattedValue: '0.0 turns/table',
        unit: 'turns',
        interpretation: 'Invalid table count.'
      };
    }
    const turns = completedOrders / totalTables;
    return {
      metricName: 'Table Turnover Rate',
      formula: 'Completed Orders ÷ Total Tables',
      inputs: { completedOrders, totalTables },
      calculatedValue: Math.round(turns * 10) / 10,
      formattedValue: `${(Math.round(turns * 10) / 10).toFixed(1)} turns/table`,
      unit: 'turns',
      benchmarkOrTarget: '4.0 – 6.0 turns/day for high-performance dining',
      interpretation: 'Rate at which dining tables are reseated and served over a full operational day.'
    };
  },

  // 6. Food Cost Percentage: (Ingredient Cost ÷ Food Sales) * 100
  calculateFoodCostPercentage: (ingredientCost: number, foodSales: number): MetricCalculation => {
    if (foodSales <= 0) {
      return {
        metricName: 'Food Cost Percentage',
        formula: '(Ingredient Cost ÷ Food Sales) × 100',
        inputs: { ingredientCost, foodSales },
        calculatedValue: 0,
        formattedValue: '0.0%',
        unit: '%',
        interpretation: 'Cannot compute food cost with zero food sales.'
      };
    }
    const costPct = (ingredientCost / foodSales) * 100;
    return {
      metricName: 'Food Cost Percentage',
      formula: '(Ingredient Cost ÷ Food Sales) × 100',
      inputs: { ingredientCost, foodSales },
      calculatedValue: Math.round(costPct * 10) / 10,
      formattedValue: `${(Math.round(costPct * 10) / 10).toFixed(1)}%`,
      unit: '%',
      benchmarkOrTarget: '28% – 32% industry benchmark',
      interpretation: costPct <= 32 
        ? 'Excellent prime food cost control.' 
        : 'Elevated food cost: inspect kitchen recipe yields, portioning, or vendor procurement prices.'
    };
  }
};
