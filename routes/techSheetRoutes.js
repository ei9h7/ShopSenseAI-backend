import express from 'express';
import gptService from '../services/gptService.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * Tech Sheet Routes
 * 
 * Handles tech sheet generation and management endpoints
 * Note: This is a placeholder implementation using in-memory storage
 * In production, this should use a proper database
 */

// In-memory storage (replace with database)
const techSheets = new Map();

// Get all tech sheets
router.get('/', (req, res) => {
    try {
        logger.info('Fetching tech sheets');
        
        const allTechSheets = Array.from(techSheets.values())
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        res.json({
            success: true,
            techSheets: allTechSheets,
            count: allTechSheets.length
        });
    } catch (error) {
        logger.error('Error fetching tech sheets:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch tech sheets'
        });
    }
});

// Generate new tech sheet
router.post('/generate', async (req, res) => {
    try {
        const { jobDescription, vehicleInfo, customerName } = req.body;
        
        if (!jobDescription) {
            return res.status(400).json({
                success: false,
                error: 'Job description is required'
            });
        }
        
        logger.info('Generating tech sheet', { jobDescription, vehicleInfo });
        
        let techSheetData;
        
        if (gptService.isConfigured()) {
            // Generate with AI
            try {
                const aiResult = await gptService.generateTechSheet(jobDescription, vehicleInfo);
                
                // Parse AI response
                const cleanResponse = aiResult.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                const parsedResponse = JSON.parse(cleanResponse);
                
                techSheetData = {
                    id: Date.now().toString(),
                    title: parsedResponse.title || `Tech Sheet for ${jobDescription}`,
                    description: jobDescription,
                    vehicle_info: vehicleInfo,
                    customer_name: customerName,
                    estimated_time: parsedResponse.estimated_time || 2,
                    difficulty: parsedResponse.difficulty || 'Medium',
                    tools_required: Array.isArray(parsedResponse.tools_required) ? parsedResponse.tools_required : ['Basic hand tools'],
                    parts_needed: Array.isArray(parsedResponse.parts_needed) ? parsedResponse.parts_needed : ['As needed'],
                    safety_warnings: Array.isArray(parsedResponse.safety_warnings) ? parsedResponse.safety_warnings : ['Follow safety procedures'],
                    step_by_step: Array.isArray(parsedResponse.step_by_step) ? parsedResponse.step_by_step : ['Follow standard procedures'],
                    tips: Array.isArray(parsedResponse.tips) ? parsedResponse.tips : ['Refer to service manual'],
                    created_at: new Date().toISOString(),
                    generated_by: 'ai',
                    source: customerName ? 'booking' : 'manual'
                };
                
                logger.success('AI tech sheet generated', { techSheetId: techSheetData.id });
                
            } catch (aiError) {
                logger.warn('AI generation failed, using fallback', aiError);
                techSheetData = createFallbackTechSheet(jobDescription, vehicleInfo, customerName);
            }
        } else {
            // Use fallback template
            logger.info('AI not configured, using fallback template');
            techSheetData = createFallbackTechSheet(jobDescription, vehicleInfo, customerName);
        }
        
        // Store tech sheet
        techSheets.set(techSheetData.id, techSheetData);
        
        res.status(201).json({
            success: true,
            techSheet: techSheetData,
            message: 'Tech sheet generated successfully'
        });
        
    } catch (error) {
        logger.error('Error generating tech sheet:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate tech sheet'
        });
    }
});

// Get single tech sheet
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const techSheet = techSheets.get(id);

        if (!techSheet) {
            return res.status(404).json({
                success: false,
                error: 'Tech sheet not found'
            });
        }

        res.json({
            success: true,
            techSheet
        });
    } catch (error) {
        logger.error('Error fetching tech sheet:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch tech sheet'
        });
    }
});

/**
 * Create fallback tech sheet when AI is unavailable
 */
function createFallbackTechSheet(jobDescription, vehicleInfo, customerName) {
    const lowerDesc = jobDescription.toLowerCase();
    
    let title = `${jobDescription.substring(0, 50)}${vehicleInfo ? ` - ${vehicleInfo}` : ''}`;
    let estimatedTime = 2;
    let difficulty = 'Medium';
    let tools = ['Basic hand tools', 'Socket set', 'Wrench set'];
    let parts = ['As specified in job description'];
    let safety = ['Wear safety glasses', 'Use proper lifting techniques', 'Ensure vehicle is secure'];
    let steps = [
        'Assess the vehicle and confirm the issue',
        'Gather all required tools and parts',
        'Follow manufacturer specifications',
        'Perform the repair work carefully',
        'Test functionality after completion',
        'Clean up work area and dispose of waste properly'
    ];
    let tips = ['Take photos before disassembly', 'Keep parts organized', 'Refer to service manual'];

    // Customize based on job type
    if (lowerDesc.includes('brake')) {
        title = `Brake Service${vehicleInfo ? ` - ${vehicleInfo}` : ''}`;
        estimatedTime = 1.5;
        tools = ['Brake tools', 'C-clamp', 'Socket set', 'Torque wrench'];
        parts = ['Brake pads', 'Brake fluid', 'Hardware kit'];
        safety = ['Never work under vehicle without proper support', 'Brake fluid is corrosive', 'Test brakes before driving'];
        steps = [
            'Lift vehicle and remove wheels',
            'Inspect brake system components',
            'Remove old brake pads',
            'Clean and lubricate caliper slides',
            'Install new brake pads',
            'Bleed brake system if needed',
            'Test brake pedal feel and function'
        ];
    } else if (lowerDesc.includes('oil')) {
        title = `Oil Change${vehicleInfo ? ` - ${vehicleInfo}` : ''}`;
        estimatedTime = 0.5;
        difficulty = 'Easy';
        tools = ['Oil drain pan', 'Socket wrench', 'Oil filter wrench', 'Funnel'];
        parts = ['Engine oil', 'Oil filter', 'Drain plug gasket'];
        steps = [
            'Warm engine to operating temperature',
            'Lift vehicle and locate drain plug',
            'Drain old oil completely',
            'Replace oil filter',
            'Install new drain plug with gasket',
            'Lower vehicle and add new oil',
            'Check oil level and for leaks'
        ];
    }

    return {
        id: Date.now().toString(),
        title,
        description: jobDescription,
        vehicle_info: vehicleInfo,
        customer_name: customerName,
        estimated_time: estimatedTime,
        difficulty,
        tools_required: tools,
        parts_needed: parts,
        safety_warnings: safety,
        step_by_step: steps,
        tips,
        created_at: new Date().toISOString(),
        generated_by: 'manual',
        source: customerName ? 'booking' : 'manual'
    };
}

export default router;