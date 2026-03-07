import React from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

const plans = [
    {
        name: "Free",
        price: "0",
        description: "Perfect for exploring Dabby's capabilities.",
        features: [
            "1 Workbench",
            "5 Chat Sessions",
            "50 Document Uploads",
            "30 Days Data Retention",
            "Email Support",
        ],
        cta: "Get Started",
        link: "/signup",
        highlight: false,
    },
    {
        name: "Go",
        price: "3,999",
        description: "Ideal for growing founders and analysts.",
        features: [
            "5 Workbenches",
            "25 Chat Sessions",
            "500 Document Uploads",
            "365 Days Data Retention",
            "Priority Support",
            "Advanced Analytics",
        ],
        cta: "Upgrade to Go",
        link: "https://rzp.io/rzp/fki0zDFJ",
        highlight: true,
    },
    {
        name: "Pro",
        price: "14,999",
        description: "The ultimate power for finance professionals.",
        features: [
            "25 Workbenches",
            "100 Chat Sessions",
            "5,000 Document Uploads",
            "1,095 Days Data Retention",
            "Dedicated account manager",
            "Custom integrations",
        ],
        cta: "Upgrade to Pro",
        link: "https://rzp.io/rzp/geIFJn7n",
        highlight: false,
    },
];

export default function Pricing() {
    const { theme } = useTheme();
    const isDark = theme === "dark";

    return (
        <section id="pricing" className={`py-24 px-6 ${isDark ? "bg-black/50" : "bg-white/50"} backdrop-blur-sm`}>
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className={`text-4xl md:text-5xl font-bold mb-6 ${isDark ? "text-white" : "text-[#1a1a1a]"}`}
                    >
                        Simple, Transparent <span className="text-[#81E6D9]">Pricing</span>
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className={`text-lg max-w-2xl mx-auto ${isDark ? "text-gray-400" : "text-gray-600"}`}
                    >
                        Choose the plan that fits your needs. No hidden fees, cancel anytime.
                    </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {plans.map((plan, index) => (
                        <motion.div
                            key={plan.name}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className={`relative p-8 rounded-3xl border transition-all duration-300 ${plan.highlight
                                ? isDark
                                    ? "bg-[#81E6D9]/5 border-[#81E6D9] shadow-[0_0_30px_rgba(129,230,217,0.1)]"
                                    : "bg-teal-50/50 border-[#81E6D9] shadow-lg"
                                : isDark
                                    ? "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                                    : "bg-white border-gray-200 hover:shadow-md"
                                }`}
                        >
                            {plan.highlight && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#81E6D9] text-black text-xs font-bold rounded-full uppercase tracking-wider">
                                    Most Popular
                                </div>
                            )}

                            <div className="mb-8">
                                <h3 className={`text-xl font-bold mb-2 ${isDark ? "text-white" : "text-[#1a1a1a]"}`}>
                                    {plan.name}
                                </h3>
                                <div className="flex items-baseline gap-1 mb-4">
                                    <span className={`text-4xl font-bold ${isDark ? "text-white" : "text-[#1a1a1a]"}`}>
                                        ₹{plan.price}
                                    </span>
                                    <span className={`${isDark ? "text-gray-400" : "text-gray-500"}`}>/month</span>
                                </div>
                                <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                                    {plan.description}
                                </p>
                            </div>

                            <ul className="space-y-4 mb-8">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex gap-3 items-start">
                                        <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-[#81E6D9]/20 flex items-center justify-center">
                                            <Check className="w-3 h-3 text-[#81E6D9]" />
                                        </div>
                                        <span className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                                            {feature}
                                        </span>
                                    </li>
                                ))}
                            </ul>

                            <a
                                href={plan.link}
                                target={plan.link.startsWith("http") ? "_blank" : "_self"}
                                rel={plan.link.startsWith("http") ? "noopener noreferrer" : ""}
                                className={`block w-full py-4 px-6 rounded-2xl text-center font-bold transition-all duration-200 ${plan.highlight
                                    ? "bg-[#81E6D9] text-black hover:bg-[#70d4c7] hover:scale-[1.02]"
                                    : isDark
                                        ? "bg-white/10 text-white hover:bg-white/20"
                                        : "bg-black text-white hover:bg-gray-800"
                                    }`}
                            >
                                {plan.cta}
                            </a>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
