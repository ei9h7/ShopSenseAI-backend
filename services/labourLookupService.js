import logger from '../utils/logger.js';

/**
 * Labour Lookup Service
 * 
 * Provides labor hour estimates for common automotive services
 * Uses static lookup table with industry-standard labor times
 */

class LabourLookupService {
    constructor() {
        this.labourTable = this.initializeLaborTable();
    }

    /**
     * Initialize the labor time lookup table
     */
    initializeLaborTable() {
        return {
            // Oil & Filter Services
            'oil change': 0.5,
            'oil service': 0.5,
            'oil and filter': 0.5,
            'lube service': 0.5,

            // Brake Services
            'front brakes': 1.8,
            'rear brakes': 1.5,
            'brake pads': 1.8,
            'brake service': 2.0,
            'brake fluid': 0.5,
            'brake inspection': 0.5,
            'brake rotors': 2.5,
            'brake calipers': 2.0,

            // Tune-Up Services
            'tune up': 2.0,
            'tune-up': 2.0,
            'spark plugs': 1.5,
            'air filter': 0.3,
            'fuel filter': 1.0,
            'pcv valve': 0.5,

            // Electrical
            'battery': 0.5,
            'alternator': 2.5,
            'starter': 2.0,
            'battery test': 0.2,
            'charging system': 1.5,

            // Cooling System
            'radiator': 3.5,
            'water pump': 4.0,
            'thermostat': 1.5,
            'coolant flush': 1.0,
            'radiator hose': 1.0,
            'cooling system': 2.0,

            // Transmission
            'transmission service': 1.5,
            'transmission fluid': 1.0,
            'transmission flush': 2.0,
            'clutch': 8.0,

            // Suspension & Steering
            'struts': 3.0,
            'shocks': 2.0,
            'tie rods': 2.5,
            'ball joints': 3.0,
            'wheel alignment': 1.0,
            'wheel balance': 0.5,

            // Tires
            'tire mounting': 0.5,
            'tire rotation': 0.5,
            'tire repair': 0.5,
            'tire replacement': 1.0,

            // Engine Services
            'timing belt': 6.0,
            'serpentine belt': 1.0,
            'head gasket': 12.0,
            'valve adjustment': 3.0,
            'fuel injection cleaning': 1.5,

            // Exhaust
            'muffler': 1.5,
            'exhaust pipe': 2.0,
            'catalytic converter': 2.5,

            // HVAC
            'ac service': 1.5,
            'ac recharge': 1.0,
            'heater core': 6.0,
            'cabin filter': 0.3,

            // Belts & Hoses
            'drive belt': 1.0,
            'timing belt': 6.0,
            'radiator hose': 1.0,
            'heater hose': 1.5,

            // Sensors
            'o2 sensor': 1.0,
            'oxygen sensor': 1.0,
            'maf sensor': 0.5,
            'map sensor': 0.5,
            'throttle position sensor': 1.0,

            // Diagnostic
            'diagnostic': 1.0,
            'inspection': 0.5,
            'check engine light': 1.0,
            'computer scan': 0.5,

            // Differential & Axles
            'differential service': 1.5,
            'cv joint': 3.0,
            'axle': 3.5,

            // Fuel System
            'fuel pump': 3.0,
            'fuel injectors': 4.0,
            'fuel system cleaning': 1.5,

            // Miscellaneous
            'window regulator': 2.5,
            'door lock actuator': 1.5,
            'windshield wipers': 0.5,
            'light bulb': 0.3,
            'general inspection': 1.0,
            'safety inspection': 1.0,
            'pre-purchase inspection': 1.5
        };
    }

    /**
     * Get labor hours for a service request
     */
    getHours(serviceRequest) {
        try {
            logger.debug('Looking up labor hours', { serviceRequest });

            const lowerRequest = serviceRequest.toLowerCase();
            
            // Direct lookup first
            if (this.labourTable[lowerRequest]) {
                const hours = this.labourTable[lowerRequest];
                logger.success('Direct labor match found', { serviceRequest, hours });
                return hours;
            }

            // Keyword matching
            let bestMatch = null;
            let maxMatches = 0;

            Object.entries(this.labourTable).forEach(([service, hours]) => {
                const serviceWords = service.split(' ');
                const requestWords = lowerRequest.split(' ');
                
                const matches = serviceWords.filter(word => 
                    requestWords.some(reqWord => reqWord.includes(word) || word.includes(reqWord))
                ).length;

                if (matches > maxMatches) {
                    maxMatches = matches;
                    bestMatch = { service, hours };
                }
            });

            if (bestMatch && maxMatches > 0) {
                logger.success('Keyword labor match found', { 
                    serviceRequest, 
                    matchedService: bestMatch.service,
                    hours: bestMatch.hours,
                    matches: maxMatches
                });
                return bestMatch.hours;
            }

            // No match found - return default
            const defaultHours = this.getDefaultHours(lowerRequest);
            logger.info('No labor match found, using default', { 
                serviceRequest, 
                defaultHours 
            });
            
            return defaultHours;

        } catch (error) {
            logger.error('Error looking up labor hours:', error);
            return 1.0; // Safe default
        }
    }

    /**
     * Get default hours based on service complexity
     */
    getDefaultHours(serviceRequest) {
        // Analyze complexity keywords
        const complexityKeywords = {
            quick: ['oil', 'filter', 'light', 'bulb', 'inspection', 'test', 'check'],
            medium: ['service', 'replace', 'repair', 'adjust', 'clean'],
            complex: ['engine', 'transmission', 'rebuild', 'overhaul', 'major']
        };

        for (const [complexity, keywords] of Object.entries(complexityKeywords)) {
            if (keywords.some(keyword => serviceRequest.includes(keyword))) {
                switch (complexity) {
                    case 'quick': return 0.5;
                    case 'medium': return 1.5;
                    case 'complex': return 4.0;
                }
            }
        }

        return 1.0; // Default 1 hour
    }

    /**
     * Get detailed service information
     */
    getServiceDetails(serviceRequest) {
        const hours = this.getHours(serviceRequest);
        const laborRate = parseInt(process.env.LABOR_RATE || '80');
        const laborCost = hours * laborRate;

        return {
            service: serviceRequest,
            laborHours: hours,
            laborRate: laborRate,
            laborCost: laborCost,
            difficulty: this.getDifficulty(hours),
            estimatedTime: this.formatEstimatedTime(hours)
        };
    }

    /**
     * Get difficulty level based on labor hours
     */
    getDifficulty(hours) {
        if (hours <= 1) return 'Easy';
        if (hours <= 3) return 'Medium';
        if (hours <= 6) return 'Hard';
        return 'Expert';
    }

    /**
     * Format estimated time for display
     */
    formatEstimatedTime(hours) {
        if (hours < 1) {
            const minutes = Math.round(hours * 60);
            return `${minutes} minutes`;
        } else if (hours === 1) {
            return '1 hour';
        } else {
            return `${hours} hours`;
        }
    }

    /**
     * Add custom labor time
     */
    addCustomLaborTime(service, hours) {
        try {
            const lowerService = service.toLowerCase();
            this.labourTable[lowerService] = hours;
            
            logger.info('Custom labor time added', { service: lowerService, hours });
            return true;

        } catch (error) {
            logger.error('Error adding custom labor time:', error);
            return false;
        }
    }

    /**
     * Get all services in category
     */
    getServicesByCategory(category) {
        const categories = {
            oil: ['oil change', 'oil service', 'oil and filter', 'lube service'],
            brakes: ['front brakes', 'rear brakes', 'brake pads', 'brake service', 'brake fluid', 'brake rotors'],
            electrical: ['battery', 'alternator', 'starter', 'charging system'],
            cooling: ['radiator', 'water pump', 'thermostat', 'coolant flush', 'cooling system'],
            tuneup: ['tune up', 'spark plugs', 'air filter', 'fuel filter', 'pcv valve']
        };

        const categoryServices = categories[category.toLowerCase()] || [];
        
        return categoryServices.map(service => ({
            service,
            hours: this.labourTable[service] || 1.0,
            cost: (this.labourTable[service] || 1.0) * parseInt(process.env.LABOR_RATE || '80')
        }));
    }

    /**
     * Search services by keyword
     */
    searchServices(keyword) {
        const lowerKeyword = keyword.toLowerCase();
        const matches = [];

        Object.entries(this.labourTable).forEach(([service, hours]) => {
            if (service.includes(lowerKeyword)) {
                matches.push({
                    service,
                    hours,
                    cost: hours * parseInt(process.env.LABOR_RATE || '80')
                });
            }
        });

        return matches.sort((a, b) => a.hours - b.hours);
    }

    /**
     * Get labor statistics
     */
    getLaborStats() {
        const services = Object.entries(this.labourTable);
        const hours = services.map(([, h]) => h);
        
        return {
            totalServices: services.length,
            averageHours: Math.round((hours.reduce((sum, h) => sum + h, 0) / hours.length) * 100) / 100,
            quickServices: services.filter(([, h]) => h <= 1).length,
            mediumServices: services.filter(([, h]) => h > 1 && h <= 3).length,
            complexServices: services.filter(([, h]) => h > 3).length,
            laborRate: parseInt(process.env.LABOR_RATE || '80')
        };
    }
}

export default new LabourLookupService();