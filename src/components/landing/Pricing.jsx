import React, { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { Link } from "react-router-dom";
import { saveRedirectIntent } from "../../utils/redirectUtility";
import { backendService } from "../../services/backendService";

const plans = [
    {
        key: "starter",
        name: "Starter",
        price: "4,000",
        description: "For freelancers and solo founders.",
        features: [
            "AI template generator",
            "Download templates (.xlsx)",
            "50 AI requests / month",
            "Limited dataset uploads",
            "Email support",
        ],
        audience: [
            "Individuals and early-stage founders",
            "Teams validating workflows",
            "Users creating downloadable templates"
        ],
        value: [
            "Create and export professional templates",
            "Affordable entry to AI workflows",
            "Light-weight data uploads"
        ],
        cta: "Get Started",
        link: "https://rzp.io/rzp/7LHng9Zd",
        highlight: false,
    },
    {
        key: "professional",
        name: "Professional",
        price: "10,000",
        description: "For agencies and growing teams.",
        features: [
            "Everything in Starter",
            "Data workbench",
            "Charts and dashboards",
            "AI insights & chat",
            "500 AI requests / month",
            "Priority support",
        ],
        audience: [
            "Growing startups and finance leads",
            "Analysts collaborating with stakeholders",
            "Teams needing trend analysis and reports"
        ],
        value: [
            "Centralize datasets in the workbench",
            "Visualize KPIs with dashboards",
            "Higher AI limits with priority support"
        ],
        cta: "Get Started",
        link: "https://rzp.io/rzp/m5FCaaPM",
        highlight: true,
    },
    {
        key: "business",
        name: "Business",
        price: "15,000",
        description: "For finance teams and enterprises.",
        features: [
            "Everything in Professional",
            "Advanced analytics",
            "Priority AI processing",
            "Unlimited dataset uploads",
            "Dedicated onboarding",
        ],
        audience: [
            "Finance teams and CA firms",
            "Multi-entity, data-heavy organizations",
            "Companies needing advanced analytics"
        ],
        value: [
            "Scale with unlimited datasets",
            "Faster AI processing for teams",
            "White-glove onboarding"
        ],
        cta: "Get Started",
        link: "https://rzp.io/rzp/gYb8Stp",
        highlight: false,
    },
];

export default function Pricing({ showDetails = false }) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [loadingPlan, setLoadingPlan] = useState(null);
    const startSubscription = async (planId) => {
        try {
            setLoadingPlan(planId);
            const data = await backendService.createSubscriptionLink(planId);
            const url = data?.short_url;
            if (url) {
                window.location.href = url;
            } else {
                alert("Could not create payment link. Please try again in a moment.");
            }
        } catch (err) {
            console.error("create-subscription failed:", err);
            alert("Payment link creation failed. Please ensure the payment service is available.");
        } finally {
            setLoadingPlan(null);
        }
    };

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
                        Simple <span className="text-[#81E6D9]">Pricing</span>
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className={`text-lg max-w-2xl mx-auto ${isDark ? "text-gray-400" : "text-gray-600"}`}
                    >
                        Start free. Scale as your team grows. No hidden fees.
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

                            {showDetails && (
                                <div className="space-y-6 mb-8">
                                    <div>
                                        <h4 className={`text-sm font-semibold mb-2 ${isDark ? "text-white" : "text-[#1a1a1a]"}`}>
                                            Who is it for
                                        </h4>
                                        <ul className="space-y-2">
                                            {plan.audience?.map((item) => (
                                                <li key={item} className={`${isDark ? "text-gray-300" : "text-gray-700"} text-sm`}>
                                                    • {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className={`text-sm font-semibold mb-2 ${isDark ? "text-white" : "text-[#1a1a1a]"}`}>
                                            Value for you
                                        </h4>
                                        <ul className="space-y-2">
                                            {plan.value?.map((item) => (
                                                <li key={item} className={`${isDark ? "text-gray-300" : "text-gray-700"} text-sm`}>
                                                    • {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {plan.planId ? (
                                <button
                                    onClick={() => startSubscription(plan.planId)}
                                    disabled={loadingPlan === plan.planId}
                                    className={`block w-full py-4 px-6 rounded-2xl text-center font-bold transition-all duration-200 ${plan.highlight
                                        ? "bg-[#81E6D9] text-black hover:bg-[#70d4c7] hover:scale-[1.02]"
                                        : isDark
                                            ? "bg-white/10 text-white hover:bg-white/20"
                                            : "bg-black text-white hover:bg-gray-800"
                                        }`}
                                >
                                    {loadingPlan === plan.planId ? "Redirecting..." : plan.cta}
                                </button>
                            ) : plan.link && plan.link.startsWith("http") ? (
                                <a
                                    href={plan.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`block w-full py-4 px-6 rounded-2xl text-center font-bold transition-all duration-200 ${plan.highlight
                                        ? "bg-[#81E6D9] text-black hover:bg-[#70d4c7] hover:scale-[1.02]"
                                        : isDark
                                            ? "bg-white/10 text-white hover:bg-white/20"
                                            : "bg-black text-white hover:bg-gray-800"
                                        }`}
                                >
                                    {plan.cta}
                                </a>
                            ) : (
                                <Link
                                    to={plan.link || "/signup"}
                                    onClick={() => saveRedirectIntent("/pricing")}
                                    className={`block w-full py-4 px-6 rounded-2xl text-center font-bold transition-all duration-200 ${plan.highlight
                                        ? "bg-[#81E6D9] text-black hover:bg-[#70d4c7] hover:scale-[1.02]"
                                        : isDark
                                            ? "bg-white/10 text-white hover:bg-white/20"
                                            : "bg-black text-white hover:bg-gray-800"
                                        }`}
                                >
                                    {plan.cta}
                                </Link>
                            )}
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
